import type { SQLiteDatabase } from 'expo-sqlite';
import { newId } from './sync/ids';

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
 * Ultima captura de la tienda guardada en este telefono. No filtra por usuario:
 * venga de quien venga, es la mejor ubicacion conocida en el dispositivo.
 */
export async function latestLocalCapture(db: SQLiteDatabase, storeId: string): Promise<LatLng | null> {
  return db.getFirstAsync<LatLng>(
    `SELECT lat, lng FROM store_gps_captures WHERE store_id = ? ORDER BY captured_at DESC, rowid DESC LIMIT 1`,
    storeId,
  );
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
