import type { SupabaseClient } from '@supabase/supabase-js';
import type { SQLiteDatabase } from 'expo-sqlite';
import { toSessionPayload, toPingPayload, toVisitPayload, toCompetitionPayload } from '../services/sync/payloads';
import { uploadPhotos } from '../services/sync/photoUpload';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : JSON.stringify(e));

export function splitUploadable(pings: { ping_id: string; user_id: string | null }[]): { ok: string[]; orphan: string[] } {
  const ok: string[] = [], orphan: string[] = [];
  for (const p of pings) (p.user_id ? ok : orphan).push(p.ping_id);
  return { ok, orphan };
}

type PingRow = { ping_id: string; session_id: string | null; user_id: string | null; timestamp: string; lat: number; lng: number };

export function getUnsyncedPings(db: SQLiteDatabase): Promise<PingRow[]> {
  return db.getAllAsync<PingRow>(
    `SELECT p.ping_id, p.session_id, COALESCE(p.user_id, s.user_id) AS user_id, p.timestamp, p.lat, p.lng
       FROM location_pings p LEFT JOIN sessions s ON s.session_id = p.session_id
      WHERE p.synced = 0`,
  );
}

export async function flushPings(db: SQLiteDatabase, supabase: SupabaseClient): Promise<number> {
  let pushed = 0;
  const pings = (await getUnsyncedPings(db)).filter((p) => p.user_id);
  for (const p of pings) {
    try {
      const { error } = await supabase.from('location_pings').upsert(toPingPayload(p), { onConflict: 'ping_id' });
      if (error) throw error;
      await db.runAsync(`UPDATE location_pings SET synced = 1 WHERE ping_id = ?`, p.ping_id);
      pushed++;
    } catch (e) { console.warn(`[sync] ping ${p.ping_id} FAIL:`, errMsg(e)); }
  }
  return pushed;
}

let isFlushing = false;
export async function flush(db: SQLiteDatabase, supabase: SupabaseClient): Promise<{ pushed: number; failed: number }> {
  if (isFlushing) return { pushed: 0, failed: 0 };
  isFlushing = true;
  let pushed = 0, failed = 0;
  try {
    for (const s of await db.getAllAsync<any>(`SELECT * FROM sessions WHERE synced = 0`)) {
      try { const { error } = await supabase.from('sessions').upsert(toSessionPayload(s), { onConflict: 'session_id' }); if (error) throw error; await db.runAsync(`UPDATE sessions SET synced=1 WHERE session_id=?`, s.session_id); pushed++; }
      catch (e) { failed++; console.warn(`[sync] session ${s.session_id} FAIL:`, errMsg(e)); }
    }
    pushed += await flushPings(db, supabase);
    for (const v of await db.getAllAsync<any>(`SELECT * FROM visits WHERE synced = 0`)) {
      try { const uris: string[] = v.photo_uri ? JSON.parse(v.photo_uri) : []; const urls = await uploadPhotos(supabase, v.user_id, v.visit_id, uris); const { error } = await supabase.from('visits').upsert(toVisitPayload(v, urls), { onConflict: 'visit_id' }); if (error) throw error; await db.runAsync(`UPDATE visits SET synced=1 WHERE visit_id=?`, v.visit_id); pushed++; }
      catch (e) { failed++; console.warn(`[sync] visit ${v.visit_id} FAIL:`, errMsg(e)); }
    }
    for (const c of await db.getAllAsync<any>(`SELECT * FROM competition_reports WHERE synced = 0`)) {
      try { const uris: string[] = c.photo_uri ? JSON.parse(c.photo_uri) : []; const urls = await uploadPhotos(supabase, c.user_id, c.report_id, uris); const { error } = await supabase.from('competition_reports').upsert(toCompetitionPayload(c, urls), { onConflict: 'report_id' }); if (error) throw error; await db.runAsync(`UPDATE competition_reports SET synced=1 WHERE report_id=?`, c.report_id); pushed++; }
      catch (e) { failed++; console.warn(`[sync] comp ${c.report_id} FAIL:`, errMsg(e)); }
    }
  } finally { isFlushing = false; }
  return { pushed, failed };
}

export async function pendingCount(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM sessions WHERE synced=0)
          + (SELECT COUNT(*) FROM location_pings p LEFT JOIN sessions s ON s.session_id=p.session_id WHERE p.synced=0 AND COALESCE(p.user_id,s.user_id) IS NOT NULL)
          + (SELECT COUNT(*) FROM visits WHERE synced=0)
          + (SELECT COUNT(*) FROM competition_reports WHERE synced=0) AS n`);
  return row?.n ?? 0;
}
