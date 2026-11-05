import type { SQLiteDatabase } from 'expo-sqlite';
import { newId } from './sync/ids';
import { withTimeout } from '../utils/withTimeout';

export type LatLng = { lat: number; lng: number };

/** Encola la captura para subirla con el flush. Devuelve su capture_id; lanza si SQLite falla. */
export async function queueGpsCapture(
  db: SQLiteDatabase,
  input: { storeId: string; userId: string; lat: number; lng: number; nowIso: string },
): Promise<string> {
  const captureId = newId();
  await db.runAsync(
    `INSERT INTO store_gps_captures (capture_id, store_id, user_id, lat, lng, captured_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    captureId, input.storeId, input.userId, input.lat, input.lng, input.nowIso,
  );
  return captureId;
}

/**
 * Ultima captura de la tienda que sigue PENDIENTE de subir en este telefono. No filtra por
 * usuario: venga de quien venga, el servidor aun no la tiene. Una captura cerrada (subida o
 * rechazada) no cuenta: de ahi en adelante manda el servidor, por ejemplo si un admin restaura el GPS.
 */
export async function latestLocalCapture(db: SQLiteDatabase, storeId: string): Promise<LatLng | null> {
  return db.getFirstAsync<LatLng>(
    `SELECT lat, lng FROM store_gps_captures WHERE store_id = ? AND synced = 0 ORDER BY captured_at DESC, rowid DESC LIMIT 1`,
    storeId,
  );
}

export const FRESH_FIX_TIMEOUT_MS = 10_000;

/**
 * Captura con un fix pedido en este momento: la escritura reemplaza las coordenadas compartidas
 * de la tienda, asi que nunca usa una ubicacion anterior. Sin fix a tiempo devuelve null y no
 * escribe nada. Lanza si SQLite falla.
 */
export async function captureWithFreshFix(
  db: SQLiteDatabase,
  input: { storeId: string; userId: string },
  getFix: () => Promise<{ coords: { latitude: number; longitude: number } }>,
  timeoutMs: number = FRESH_FIX_TIMEOUT_MS,
): Promise<LatLng | null> {
  const fix = await withTimeout<{ coords: { latitude: number; longitude: number } } | null>(getFix(), timeoutMs, null);
  if (!fix) return null;
  const coords = { lat: fix.coords.latitude, lng: fix.coords.longitude };
  await queueGpsCapture(db, { ...input, ...coords, nowIso: new Date().toISOString() });
  return coords;
}

/** Pura: coordenadas contra las que verificar. La captura local gana a la tienda del parametro de navegacion. */
export function effectiveStoreCoords(
  store: { master_lat: number | null; master_lng: number | null },
  capture: LatLng | null,
): LatLng | null {
  if (capture) return capture;
  if (store.master_lat == null || store.master_lng == null) return null;
  return { lat: store.master_lat, lng: store.master_lng };
}
