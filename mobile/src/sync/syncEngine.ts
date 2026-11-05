import type { SupabaseClient } from '@supabase/supabase-js';
import type { SQLiteDatabase } from 'expo-sqlite';
import { toSessionPayload, toPingPayload, toVisitPayload, toCompetitionPayload, toAnomalyProductPayload, toRestockProductPayload, toGpsCaptureArgs } from '../services/sync/payloads';
import { shortError, uploadPhotos } from '../services/sync/photoUpload';
import { deletePhotos } from '../services/photos/photoStore';
import { logEvent } from '../diagnostics/log';
import { nextPhotoRetry } from './photoRetry';
import { classifyError, type ErrorKind } from './errorKind';
import { withDeadline } from '../utils/withTimeout';

// Plazo máximo por request. Con señal débil (no cero) un fetch puede colgarse
// minutos; sin esto un solo request congelaba TODA la cola de sincronización
// y el banner mentía "Sincronizando…" indefinidamente.
const NET_TIMEOUT_MS = 15_000;

const MAX_PHOTO_WAIT_MS = 60 * 60_000;

/** Tiempo máximo de la fase de fotos para arrancar una. Los registros y los pings no lo miran ni lo gastan. */
export const FLUSH_BUDGET_MS = 120_000;
export const PING_BATCH = 100;

export type FlushResult = { pushed: number; failed: number; busy: boolean; errorKind: ErrorKind | null };

// Si en la pasada falló algo por culpa del servidor, reintentar con red no lo arregla: gana server.
const worstKind = (a: ErrorKind | null, b: ErrorKind): ErrorKind => (a === 'server' ? a : b);

const errMsg = (e: unknown) => (e instanceof Error ? e.message : JSON.stringify(e));

// Rechazos definitivos de fn_capturar_gps_tienda: tienda inexistente, coordenadas invalidas y captura muy vieja.
// Reintentar no puede funcionar. Todo lo demas (42501 incluido) sigue pendiente.
const GPS_CAPTURE_REJECTED = new Set(['P0002', '22023']);

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

// Filtro por dueño. RLS solo deja escribir lo propio: en un teléfono compartido
// (cerrar sesión de un mercaderista y entrar con otra cuenta) la cola del usuario
// anterior fallaba en cada pasada y dejaba el banner en "Sincronizando…" sin fin.
// Lo ajeno espera en el teléfono hasta que su dueño vuelva a entrar.
const ownedBy = (col: string, userId?: string) => (userId ? ` AND ${col} = ?` : '');
const ownerArgs = (userId?: string): string[] => (userId ? [userId] : []);

export function getUnsyncedPings(db: SQLiteDatabase, userId?: string): Promise<PingRow[]> {
  return db.getAllAsync<PingRow>(
    `SELECT p.ping_id, p.session_id, COALESCE(p.user_id, s.user_id) AS user_id, p.timestamp, p.lat, p.lng
       FROM location_pings p LEFT JOIN sessions s ON s.session_id = p.session_id
      WHERE p.synced = 0${ownedBy('COALESCE(p.user_id, s.user_id)', userId)}`,
    ...ownerArgs(userId),
  );
}

// Rechazo de PostgREST: el servidor respondió y la culpa es de alguna fila. Sin red postgrest-js
// también trae `code`, pero vacío; y un 5xx sin cuerpo JSON no trae ninguno: ahí reintentar es inútil.
const rejectedByServer = (e: unknown): boolean =>
  !!(e as { code?: unknown } | null)?.code && classifyError(e) !== 'network';

export async function flushPings(db: SQLiteDatabase, supabase: SupabaseClient, userId?: string): Promise<Omit<FlushResult, 'busy'>> {
  const out: Omit<FlushResult, 'busy'> = { pushed: 0, failed: 0, errorKind: null };
  const pings = (await getUnsyncedPings(db, userId)).filter((p) => p.user_id);
  const send = async (rows: PingRow[]) => {
    const { error } = await withDeadline(
      supabase.from('location_pings').upsert(rows.map((r) => toPingPayload(r)), { onConflict: 'ping_id' }),
      NET_TIMEOUT_MS, `pings x${rows.length}`,
    );
    if (error) throw error;
    await db.runAsync(`UPDATE location_pings SET synced=1 WHERE ping_id IN (${rows.map(() => '?').join(',')})`, ...rows.map((r) => r.ping_id));
    out.pushed += rows.length;
  };
  const fail = (e: unknown, count: number) => {
    out.failed += count;
    out.errorKind = worstKind(out.errorKind, classifyError(e));
    console.warn(`[sync] pings x${count} FAIL:`, errMsg(e));
  };
  for (let i = 0; i < pings.length; i += PING_BATCH) {
    const batch = pings.slice(i, i + PING_BATCH);
    try { await send(batch); continue; } catch (e) {
      if (!rejectedByServer(e)) { fail(e, batch.length); return out; }
    }
    // Una fila mala tumba el lote entero: uno a uno suben las demás.
    for (let j = 0; j < batch.length; j++) {
      try { await send([batch[j]]); } catch (e) {
        if (!rejectedByServer(e)) { fail(e, batch.length - j); return out; }
        fail(e, 1);
      }
    }
  }
  return out;
}

let isFlushing = false;

/**
 * Vacía la cola local hacia Supabase. Orden por valor del dato:
 * sesiones → capturas de GPS → REGISTROS de visita (sin fotos) → vínculos de anomalía → productos
 * repuestos → reportes (sin fotos) → fotos → pings.
 * El registro (pequeño, crítico) NUNCA espera por sus fotos (pesadas): sube primero
 * sin photo_urls y las fotos se completan en una fase aparte (photos_synced).
 * Con userId sube solo lo de ese usuario (el de la sesión abierta en la app).
 * `budgetMs` limita solo el arranque de fotos: lo que no alcance sigue en la próxima pasada.
 */
export async function flush(
  db: SQLiteDatabase, supabase: SupabaseClient, userId?: string,
  opts: { onProgress?: () => void; budgetMs?: number } = {},
): Promise<FlushResult> {
  if (isFlushing) return { pushed: 0, failed: 0, busy: true, errorKind: null };
  isFlushing = true;
  const { onProgress, budgetMs = FLUSH_BUDGET_MS } = opts;
  let pushed = 0, failed = 0;
  let errorKind = null as ErrorKind | null;
  const noteKind = (k: ErrorKind) => { errorKind = worstKind(errorKind, k); };
  const fail = (e: unknown) => { failed++; noteKind(classifyError(e)); };
  const done = () => { pushed++; onProgress?.(); };
  try {
    // 1) Sesiones (las visitas referencian session_id).
    for (const s of await db.getAllAsync<any>(`SELECT * FROM sessions WHERE synced = 0${ownedBy('user_id', userId)}`, ...ownerArgs(userId))) {
      try {
        const { error } = await withDeadline(
          supabase.from('sessions').upsert(toSessionPayload(s), { onConflict: 'session_id' }),
          NET_TIMEOUT_MS, `session ${s.session_id}`,
        );
        if (error) throw error;
        await db.runAsync(`UPDATE sessions SET synced=1 WHERE session_id=?`, s.session_id);
        done();
      } catch (e) { fail(e); console.warn(`[sync] session ${s.session_id} FAIL:`, errMsg(e)); }
    }

    // 1b) Capturas de GPS de la tienda. El capture_id las hace idempotentes en el servidor.
    for (const c of await db.getAllAsync<any>(
      `SELECT * FROM store_gps_captures WHERE synced = 0${ownedBy('user_id', userId)} ORDER BY captured_at`,
      ...ownerArgs(userId),
    )) {
      try {
        const { error } = await withDeadline(
          supabase.rpc('fn_capturar_gps_tienda', toGpsCaptureArgs(c)),
          NET_TIMEOUT_MS, `gps ${c.capture_id}`,
        );
        const code = (error as { code?: string } | null)?.code;
        if (error && !GPS_CAPTURE_REJECTED.has(code ?? '')) throw error;
        // El log va antes del cierre: si la app muere en medio, es el unico rastro del rechazo.
        if (error) await logEvent(db, 'warn', 'gps_capture_rejected', `${c.capture_id} ${code}`, c.user_id);
        await db.runAsync(`UPDATE store_gps_captures SET synced=1 WHERE capture_id=?`, c.capture_id);
        if (!error) pushed++;
        onProgress?.();
      } catch (e) { fail(e); console.warn(`[sync] gps ${c.capture_id} FAIL:`, errMsg(e)); }
    }

    // 2) Registros de visita SIN esperar fotos.
    for (const v of await db.getAllAsync<any>(`SELECT * FROM visits WHERE synced = 0${ownedBy('user_id', userId)}`, ...ownerArgs(userId))) {
      try {
        const { error } = await withDeadline(
          supabase.from('visits').upsert(toVisitPayload(v), { onConflict: 'visit_id' }),
          NET_TIMEOUT_MS, `visit ${v.visit_id}`,
        );
        if (error) throw error;
        await db.runAsync(
          `UPDATE visits SET synced=1, photos_synced=? WHERE visit_id=?`,
          photoCount(v.photo_uri) > 0 ? 0 : 1, v.visit_id,
        );
        done();
      } catch (e) { fail(e); console.warn(`[sync] visit ${v.visit_id} FAIL:`, errMsg(e)); }
    }

    // 2b) Vinculos anomalia↔producto. Van DESPUES de las visitas: la FK y el
    // trigger de validacion exigen que la visita ya exista en Supabase.
    for (const ap of await db.getAllAsync<any>(
      `SELECT ap.* FROM visit_anomaly_products ap
         JOIN visits v ON v.visit_id = ap.visit_id
        WHERE ap.synced = 0 AND v.synced = 1${ownedBy('v.user_id', userId)}`,
      ...ownerArgs(userId),
    )) {
      try {
        const { error } = await withDeadline(
          supabase.from('visit_anomaly_products').upsert(
            toAnomalyProductPayload(ap), { onConflict: 'visit_id,anomaly_type,product_id' },
          ),
          NET_TIMEOUT_MS, `anomaly_product ${ap.visit_id}/${ap.product_id}`,
        );
        if (error) throw error;
        await db.runAsync(
          `UPDATE visit_anomaly_products SET synced=1
            WHERE visit_id=? AND anomaly_type=? AND product_id=?`,
          ap.visit_id, ap.anomaly_type, ap.product_id,
        );
        done();
      } catch (e) {
        fail(e);
        console.warn(`[sync] anomaly_product ${ap.visit_id}/${ap.product_id} FAIL:`, errMsg(e));
      }
    }

    // 2c) Productos repuestos. restock_id = visit_id: la fila de restocks la
    // crea un trigger al subir la visita con fecha. Si no existe (fecha nula o
    // futura), la FK falla (23503): es definitivo, se descarta.
    for (const rp of await db.getAllAsync<any>(
      `SELECT rp.* FROM restock_products rp
         JOIN visits v ON v.visit_id = rp.visit_id
        WHERE rp.synced = 0 AND v.synced = 1${ownedBy('v.user_id', userId)}`,
      ...ownerArgs(userId),
    )) {
      try {
        const { error } = await withDeadline(
          supabase.from('restock_products').upsert(
            toRestockProductPayload(rp), { onConflict: 'restock_id,product_id', ignoreDuplicates: true },
          ),
          NET_TIMEOUT_MS, `restock_product ${rp.visit_id}/${rp.product_id}`,
        );
        if (error && (error as { code?: string }).code !== '23503') throw error;
        if (error) console.warn(`[sync] restock_product ${rp.visit_id}/${rp.product_id} descartado: sin reposición en el servidor`);
        await db.runAsync(
          `UPDATE restock_products SET synced=1 WHERE visit_id=? AND product_id=?`,
          rp.visit_id, rp.product_id,
        );
        if (!error) pushed++;
        onProgress?.();
      } catch (e) {
        fail(e);
        console.warn(`[sync] restock_product ${rp.visit_id}/${rp.product_id} FAIL:`, errMsg(e));
      }
    }

    // 3) Reportes de competencia, mismo esquema.
    for (const c of await db.getAllAsync<any>(`SELECT * FROM competition_reports WHERE synced = 0${ownedBy('user_id', userId)}`, ...ownerArgs(userId))) {
      try {
        const { error } = await withDeadline(
          supabase.from('competition_reports').upsert(toCompetitionPayload(c), { onConflict: 'report_id' }),
          NET_TIMEOUT_MS, `report ${c.report_id}`,
        );
        if (error) throw error;
        await db.runAsync(
          `UPDATE competition_reports SET synced=1, photos_synced=? WHERE report_id=?`,
          photoCount(c.photo_uri) > 0 ? 0 : 1, c.report_id,
        );
        done();
      } catch (e) { fail(e); console.warn(`[sync] comp ${c.report_id} FAIL:`, errMsg(e)); }
    }

    // 4) Fotos de registros ya subidos: se completan aparte y actualizan photo_urls.
    // El presupuesto es uno solo para las dos tablas y corre desde aquí: los registros no lo gastan.
    const startedAt = Date.now();
    const phase: PhotoPhase = {
      overBudget: () => Date.now() - startedAt >= budgetMs,
      rowFailed: (errors) => { failed++; errors.forEach((err) => noteKind(classifyError(err))); },
      rowDone: done,
      onProgress,
    };
    await flushPendingPhotos(db, supabase, 'visits', 'visit_id', phase, userId);
    await flushPendingPhotos(db, supabase, 'competition_reports', 'report_id', phase, userId);

    // 5) Pings de GPS: lo menos valioso, y una ruta larga son cientos.
    const pr = await flushPings(db, supabase, userId);
    pushed += pr.pushed; failed += pr.failed;
    if (pr.errorKind) noteKind(pr.errorKind);
  } finally { isFlushing = false; }
  return { pushed, failed, busy: false, errorKind };
}

type PhotoPhase = {
  overBudget: () => boolean;
  rowFailed: (errors: string[]) => void;
  rowDone: () => void;
  onProgress?: () => void;
};

async function flushPendingPhotos(
  db: SQLiteDatabase, supabase: SupabaseClient,
  table: 'visits' | 'competition_reports', idCol: 'visit_id' | 'report_id',
  phase: PhotoPhase,
  userId?: string,
): Promise<void> {
  const sortCol = table === 'visits' ? 'check_in_time' : 'created_at';
  const nowMs = Date.now();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM ${table}
      WHERE synced = 1 AND photos_synced = 0 AND (photo_next_try IS NULL OR photo_next_try <= ? OR photo_next_try > ?)${ownedBy('user_id', userId)}
      ORDER BY ${sortCol} DESC`,
    // La espera máxima es 60 min: una fecha más lejana viene de un reloj equivocado y se ignora.
    new Date(nowMs).toISOString(), new Date(nowMs + MAX_PHOTO_WAIT_MS).toISOString(), ...ownerArgs(userId),
  );
  for (const r of rows) {
    if (phase.overBudget()) return;
    const id = r[idCol];
    const errors: string[] = [];
    try {
      const uris: string[] = r.photo_uri ? JSON.parse(r.photo_uri) : [];
      if (!Array.isArray(uris)) throw new Error('photo_uri no es un arreglo');
      if (!uris.length) { await db.runAsync(`UPDATE ${table} SET photos_synced=1 WHERE ${idCol}=?`, id); continue; }
      let doneNow = 0;
      const { listed, paths, missing, empty, failed, stopped } = await uploadPhotos(supabase, r.user_id, id, uris, {
        attempts: r.photo_attempts,
        shouldStop: phase.overBudget,
        // Queda guardado foto a foto: el banner descuenta en vivo y un cierre de la app no lo pierde.
        onPhotoDone: async () => {
          doneNow++;
          try {
            await db.runAsync(`UPDATE ${table} SET photos_done=MAX(photos_done, ?) WHERE ${idCol}=?`, doneNow, id);
          } catch (e) { console.warn(`[sync] fotos ${table}/${id} sin contar:`, errMsg(e)); }
          phase.onProgress?.();
        },
      });
      for (const f of failed) errors.push(`foto ${f.index}: ${f.error}`);
      // Se enlaza lo subido aunque otras fallen. Sin nada subido no se escribe: un arreglo
      // vacío borraría lo que ya esté enlazado. Cero filas devueltas tampoco es éxito.
      // Sin listado, una foto fallida o sin intentar puede estar ya enlazada: escribir la quitaría de photo_urls.
      if (paths.length && (listed || (!failed.length && !stopped))) {
        try {
          const { data, error } = await withDeadline(
            supabase.from(table).update({ photo_urls: paths }).eq(idCol, id).select(idCol),
            NET_TIMEOUT_MS, `photo_urls ${id}`,
          );
          if (error) throw error;
          if (!data?.length) throw new Error('update sin filas afectadas');
        } catch (e) { errors.push(`photo_urls: ${shortError(e)}`); }
      }
      // Con errores la fila sigue abierta: aunque todas estén arriba, falta enlazar y debe contar como pendiente.
      const photosDone = paths.length + missing.length;
      await db.runAsync(`UPDATE ${table} SET photos_done=? WHERE ${idCol}=?`, errors.length ? Math.min(photosDone, uris.length - 1) : photosDone, id);
      if (!errors.length) {
        if (stopped) return; // Se acabó el presupuesto: no es un fallo y no gasta intento.
        // El log va antes del cierre: si la app muere en medio, es el único rastro de la foto perdida.
        for (const i of missing) await logEvent(db, 'warn', 'photo_missing', `${id} foto ${i}${empty.includes(i) ? ' (archivo vacío)' : ''}`, r.user_id);
        // Primero se cierra y después se borra: un archivo solo se va con su foto confirmada arriba.
        await db.runAsync(`UPDATE ${table} SET photos_synced=1 WHERE ${idCol}=?`, id);
        await deletePhotos(uris);
        phase.rowDone();
        continue;
      }
    } catch (e) { errors.push(shortError(e)); }

    phase.rowFailed(errors);
    console.warn(`[sync] fotos ${table}/${id} FAIL:`, errors.join('; '));
    for (const err of errors) await logEvent(db, 'warn', 'photo_upload_fail', `${id} ${err}`, r.user_id);
    try {
      await db.runAsync(
        `UPDATE ${table} SET photo_attempts=photo_attempts+1, photo_next_try=? WHERE ${idCol}=?`,
        nextPhotoRetry(r.photo_attempts, Date.now()), id,
      );
    } catch (e) { console.warn(`[sync] fotos ${table}/${id} sin programar reintento:`, errMsg(e)); }
  }
}

/** Fotos que faltan por subir: las reales de cada fila menos las hechas. JSON inválido cuenta 0. */
export function pendingPhotos(rows: { photo_uri: string | null; photos_done: number }[]): number {
  return rows.reduce((sum, r) => sum + Math.max(0, photoCount(r.photo_uri) - r.photos_done), 0);
}

export interface PendingCounts {
  /** Registros de negocio en cola: sesiones + visitas + reportes + capturas de GPS (lo que le importa al promotor). */
  records: number;
  /** Fotos pendientes de registros que YA subieron (incluye las que esperan reintento). */
  photos: number;
  /** Pings de GPS en cola (informativo; no se muestran como "registros"). */
  pings: number;
}

// Con userId cuenta solo lo de ese usuario: el banner no debe mostrar la cola
// de otra cuenta que este teléfono no puede subir.
export async function pendingCounts(db: SQLiteDatabase, userId?: string): Promise<PendingCounts> {
  const own = (col: string) => (userId ? ` AND ${col} = $u` : '');
  const row = await db.getFirstAsync<Omit<PendingCounts, 'photos'>>(
    `SELECT
       (SELECT COUNT(*) FROM sessions WHERE synced=0${own('user_id')})
     + (SELECT COUNT(*) FROM visits WHERE synced=0${own('user_id')})
     + (SELECT COUNT(*) FROM visit_anomaly_products ap JOIN visits v ON v.visit_id=ap.visit_id WHERE ap.synced=0${own('v.user_id')})
     + (SELECT COUNT(*) FROM restock_products rp JOIN visits v ON v.visit_id=rp.visit_id WHERE rp.synced=0${own('v.user_id')})
     + (SELECT COUNT(*) FROM competition_reports WHERE synced=0${own('user_id')})
     + (SELECT COUNT(*) FROM store_gps_captures WHERE synced=0${own('user_id')}) AS records,
       (SELECT COUNT(*) FROM location_pings p LEFT JOIN sessions s ON s.session_id=p.session_id
         WHERE p.synced=0 AND COALESCE(p.user_id,s.user_id) IS NOT NULL${own('COALESCE(p.user_id,s.user_id)')}) AS pings`,
    userId ? { $u: userId } : {},
  );
  let photos = 0;
  for (const table of ['visits', 'competition_reports']) {
    photos += pendingPhotos(await db.getAllAsync<{ photo_uri: string | null; photos_done: number }>(
      `SELECT photo_uri, photos_done FROM ${table} WHERE synced = 1 AND photos_synced = 0${ownedBy('user_id', userId)}`,
      ...ownerArgs(userId),
    ));
  }
  return { records: row?.records ?? 0, photos, pings: row?.pings ?? 0 };
}
