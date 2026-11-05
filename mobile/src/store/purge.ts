import type { SQLiteDatabase } from 'expo-sqlite';
import { getMeta, setMeta } from './localStore';
import { deletePhotos, type PhotoFs } from '../services/photos/photoStore';
import { logEvent } from '../diagnostics/log';

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

/** Borra solo lo totalmente sincronizado y viejo. Las sesiones no se purgan (resolveToday las puede necesitar). */
export async function purgeLocal(db: SQLiteDatabase, nowMs: number): Promise<void> {
  const old = iso(nowMs - 30 * DAY);
  // Visita purgable: sincronizada, con fotos subidas, vieja y sin vinculos pendientes.
  const eligible = `SELECT visit_id FROM visits WHERE synced = 1 AND photos_synced = 1 AND check_in_time < ?
    AND NOT EXISTS (SELECT 1 FROM visit_anomaly_products a WHERE a.visit_id = visits.visit_id AND a.synced = 0)
    AND NOT EXISTS (SELECT 1 FROM restock_products r WHERE r.visit_id = visits.visit_id AND r.synced = 0)`;
  await db.runAsync(`DELETE FROM visit_anomaly_products WHERE visit_id IN (${eligible})`, old);
  await db.runAsync(`DELETE FROM restock_products WHERE visit_id IN (${eligible})`, old);
  await db.runAsync(`DELETE FROM visits WHERE visit_id IN (${eligible})`, old);
  await db.runAsync(`DELETE FROM competition_reports WHERE synced = 1 AND photos_synced = 1 AND created_at < ?`, old);
  const week = iso(nowMs - 7 * DAY);
  await db.runAsync(`DELETE FROM location_pings WHERE synced = 1 AND timestamp < ?`, week);
  await db.runAsync(`DELETE FROM sync_log WHERE synced = 1 AND ts < ?`, week);
}

/** URIs referenciadas por cualquier fila; null si alguna no se puede interpretar (podria esconder una referencia). */
function parseRefs(raw: string | null, into: Set<string>): boolean {
  if (raw == null || raw === '') return true;
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v) || v.some((u) => typeof u !== 'string')) return false;
    v.forEach((u) => into.add(u));
    return true;
  } catch { return false; }
}

/** Borra de la carpeta permanente las fotos que ninguna fila referencia y tienen +7 dias. Devuelve cuantas. */
export async function purgeOrphanPhotos(db: SQLiteDatabase, fs: PhotoFs, nowMs: number): Promise<number> {
  const refs = new Set<string>();
  try {
    for (const table of ['visits', 'competition_reports']) {
      const rows = await db.getAllAsync<{ photo_uri: string | null }>(`SELECT photo_uri FROM ${table}`);
      for (const r of rows) if (!parseRefs(r.photo_uri, refs)) return 0;
    }
  } catch { return 0; }
  let files: { uri: string; modifiedMs: number }[];
  try { files = await fs.list(); } catch { return 0; }
  // modifiedMs 0 = fecha desconocida: se conserva.
  const doomed = files.filter((f) => !refs.has(f.uri) && f.modifiedMs > 0 && f.modifiedMs < nowMs - 7 * DAY).map((f) => f.uri);
  await deletePhotos(doomed, fs);
  return doomed.length;
}

let purging = false;

/** Purga a lo mas una vez cada 24 h. Nunca lanza; last_purge se escribe solo si termino bien. */
export async function purgeIfDue(db: SQLiteDatabase, fs: PhotoFs, nowMs: number): Promise<void> {
  if (purging) return;
  purging = true;
  try {
    const last = Number(await getMeta(db, 'last_purge'));
    if (Number.isFinite(last) && last > 0 && nowMs - last < DAY) return;
    await purgeLocal(db, nowMs);
    await purgeOrphanPhotos(db, fs, nowMs);
    await setMeta(db, 'last_purge', String(nowMs));
  } catch (e) {
    await logEvent(db, 'warn', 'purge_failed', (e as Error)?.message ?? String(e));
  } finally { purging = false; }
}
