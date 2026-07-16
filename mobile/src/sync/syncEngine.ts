import type { SupabaseClient } from '@supabase/supabase-js';
import type { SQLiteDatabase } from 'expo-sqlite';
import { toSessionPayload, toPingPayload, toVisitPayload, toCompetitionPayload } from '../services/sync/payloads';
import { uploadPhotos } from '../services/sync/photoUpload';
import { withDeadline } from '../utils/withTimeout';

// Plazo máximo por request. Con señal débil (no cero) un fetch puede colgarse
// minutos; sin esto un solo request congelaba TODA la cola de sincronización
// y el banner mentía "Sincronizando…" indefinidamente.
const NET_TIMEOUT_MS = 15_000;

const errMsg = (e: unknown) => (e instanceof Error ? e.message : JSON.stringify(e));

export function splitUploadable(pings: { ping_id: string; user_id: string | null }[]): { ok: string[]; orphan: string[] } {
  const ok: string[] = [], orphan: string[] = [];
  for (const p of pings) (p.user_id ? ok : orphan).push(p.ping_id);
  return { ok, orphan };
}

/** Cuenta las fotos guardadas en la columna photo_uri (JSON array o null). */
export function photoCount(photoUri: string | null): number {
  if (!photoUri) return 0;
  try {
    const parsed = JSON.parse(photoUri);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch { return 0; }
}

type PingRow = { ping_id: string; session_id: string | null; user_id: string | null; timestamp: string; lat: number; lng: number };

export function getUnsyncedPings(db: SQLiteDatabase): Promise<PingRow[]> {
  return db.getAllAsync<PingRow>(
    `SELECT p.ping_id, p.session_id, COALESCE(p.user_id, s.user_id) AS user_id, p.timestamp, p.lat, p.lng
       FROM location_pings p LEFT JOIN sessions s ON s.session_id = p.session_id
      WHERE p.synced = 0`,
  );
}

export async function flushPings(db: SQLiteDatabase, supabase: SupabaseClient): Promise<{ pushed: number; failed: number }> {
  let pushed = 0, failed = 0;
  const pings = (await getUnsyncedPings(db)).filter((p) => p.user_id);
  for (const p of pings) {
    try {
      const { error } = await withDeadline(
        supabase.from('location_pings').upsert(toPingPayload(p), { onConflict: 'ping_id' }),
        NET_TIMEOUT_MS, `ping ${p.ping_id}`,
      );
      if (error) throw error;
      await db.runAsync(`UPDATE location_pings SET synced = 1 WHERE ping_id = ?`, p.ping_id);
      pushed++;
    } catch (e) { failed++; console.warn(`[sync] ping ${p.ping_id} FAIL:`, errMsg(e)); }
  }
  return { pushed, failed };
}

let isFlushing = false;

/**
 * Vacía la cola local hacia Supabase. Orden por valor del dato:
 * sesiones → REGISTROS de visita (sin fotos) → reportes (sin fotos) → pings → fotos.
 * El registro (pequeño, crítico) NUNCA espera por sus fotos (pesadas): sube primero
 * con photo_urls=[] y las fotos se completan en una fase aparte (photos_synced).
 */
export async function flush(db: SQLiteDatabase, supabase: SupabaseClient): Promise<{ pushed: number; failed: number }> {
  if (isFlushing) return { pushed: 0, failed: 0 };
  isFlushing = true;
  let pushed = 0, failed = 0;
  try {
    // 1) Sesiones (las visitas referencian session_id).
    for (const s of await db.getAllAsync<any>(`SELECT * FROM sessions WHERE synced = 0`)) {
      try {
        const { error } = await withDeadline(
          supabase.from('sessions').upsert(toSessionPayload(s), { onConflict: 'session_id' }),
          NET_TIMEOUT_MS, `session ${s.session_id}`,
        );
        if (error) throw error;
        await db.runAsync(`UPDATE sessions SET synced=1 WHERE session_id=?`, s.session_id);
        pushed++;
      } catch (e) { failed++; console.warn(`[sync] session ${s.session_id} FAIL:`, errMsg(e)); }
    }

    // 2) Registros de visita SIN esperar fotos.
    for (const v of await db.getAllAsync<any>(`SELECT * FROM visits WHERE synced = 0`)) {
      try {
        const { error } = await withDeadline(
          supabase.from('visits').upsert(toVisitPayload(v, []), { onConflict: 'visit_id' }),
          NET_TIMEOUT_MS, `visit ${v.visit_id}`,
        );
        if (error) throw error;
        await db.runAsync(
          `UPDATE visits SET synced=1, photos_synced=? WHERE visit_id=?`,
          photoCount(v.photo_uri) > 0 ? 0 : 1, v.visit_id,
        );
        pushed++;
      } catch (e) { failed++; console.warn(`[sync] visit ${v.visit_id} FAIL:`, errMsg(e)); }
    }

    // 3) Reportes de competencia, mismo esquema.
    for (const c of await db.getAllAsync<any>(`SELECT * FROM competition_reports WHERE synced = 0`)) {
      try {
        const { error } = await withDeadline(
          supabase.from('competition_reports').upsert(toCompetitionPayload(c, []), { onConflict: 'report_id' }),
          NET_TIMEOUT_MS, `report ${c.report_id}`,
        );
        if (error) throw error;
        await db.runAsync(
          `UPDATE competition_reports SET synced=1, photos_synced=? WHERE report_id=?`,
          photoCount(c.photo_uri) > 0 ? 0 : 1, c.report_id,
        );
        pushed++;
      } catch (e) { failed++; console.warn(`[sync] comp ${c.report_id} FAIL:`, errMsg(e)); }
    }

    // 4) Pings de GPS (menos críticos que los registros).
    const pr = await flushPings(db, supabase);
    pushed += pr.pushed; failed += pr.failed;

    // 5) Fotos de registros ya subidos: se completan aparte y actualizan photo_urls.
    pushed += await flushPendingPhotos(db, supabase, 'visits', 'visit_id', (n) => failed += n);
    pushed += await flushPendingPhotos(db, supabase, 'competition_reports', 'report_id', (n) => failed += n);
  } finally { isFlushing = false; }
  return { pushed, failed };
}

async function flushPendingPhotos(
  db: SQLiteDatabase, supabase: SupabaseClient,
  table: 'visits' | 'competition_reports', idCol: 'visit_id' | 'report_id',
  addFailed: (n: number) => void,
): Promise<number> {
  let pushed = 0;
  const rows = await db.getAllAsync<any>(`SELECT * FROM ${table} WHERE synced = 1 AND photos_synced = 0`);
  for (const r of rows) {
    const id = r[idCol];
    try {
      const uris: string[] = r.photo_uri ? JSON.parse(r.photo_uri) : [];
      if (!uris.length) { await db.runAsync(`UPDATE ${table} SET photos_synced=1 WHERE ${idCol}=?`, id); continue; }
      const urls = await uploadPhotos(supabase, r.user_id, id, uris, NET_TIMEOUT_MS);
      const { error } = await withDeadline(
        supabase.from(table).update({ photo_urls: urls }).eq(idCol, id),
        NET_TIMEOUT_MS, `photo_urls ${id}`,
      );
      if (error) throw error;
      await db.runAsync(`UPDATE ${table} SET photos_synced=1 WHERE ${idCol}=?`, id);
      pushed++;
    } catch (e) { addFailed(1); console.warn(`[sync] fotos ${table}/${id} FAIL:`, errMsg(e)); }
  }
  return pushed;
}

export interface PendingCounts {
  /** Registros de negocio en cola: sesiones + visitas + reportes (lo que le importa al promotor). */
  records: number;
  /** Fotos pendientes de registros que YA subieron. */
  photos: number;
  /** Pings de GPS en cola (informativo; no se muestran como "registros"). */
  pings: number;
}

export async function pendingCounts(db: SQLiteDatabase): Promise<PendingCounts> {
  const row = await db.getFirstAsync<PendingCounts>(
    `SELECT
       (SELECT COUNT(*) FROM sessions WHERE synced=0)
     + (SELECT COUNT(*) FROM visits WHERE synced=0)
     + (SELECT COUNT(*) FROM competition_reports WHERE synced=0) AS records,
       (SELECT COUNT(*) FROM visits WHERE synced=1 AND photos_synced=0)
     + (SELECT COUNT(*) FROM competition_reports WHERE synced=1 AND photos_synced=0) AS photos,
       (SELECT COUNT(*) FROM location_pings p LEFT JOIN sessions s ON s.session_id=p.session_id
         WHERE p.synced=0 AND COALESCE(p.user_id,s.user_id) IS NOT NULL) AS pings`,
  );
  return row ?? { records: 0, photos: 0, pings: 0 };
}
