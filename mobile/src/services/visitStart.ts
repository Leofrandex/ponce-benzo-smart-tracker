import type { SQLiteDatabase } from 'expo-sqlite';
import { fechaLocalISO } from '../utils/localDate';

// Cronometro de visita. La clave lleva el dia LOCAL del telefono, igual que localDayRangeUtc.

/** Inicio de la visita abierta: la primera apertura del formulario, aunque se salga y se vuelva a entrar. */
export async function getOrCreateVisitStart(db: SQLiteDatabase, userId: string, storeId: string, now: Date): Promise<string> {
  const day = fechaLocalISO(now);
  await db.runAsync(
    `INSERT OR IGNORE INTO visit_starts (user_id, store_id, day, started_at) VALUES (?, ?, ?, ?)`,
    userId, storeId, day, now.toISOString(),
  );
  const row = await db.getFirstAsync<{ started_at: string }>(
    `SELECT started_at FROM visit_starts WHERE user_id = ? AND store_id = ? AND day = ?`,
    userId, storeId, day,
  );
  if (!row) throw new Error('visit_starts sin fila');
  return row.started_at;
}

/** Tras guardar la visita: la siguiente a la misma tienda cuenta desde cero. */
export async function clearVisitStart(db: SQLiteDatabase, userId: string, storeId: string, now: Date): Promise<void> {
  await db.runAsync(
    `DELETE FROM visit_starts WHERE user_id = ? AND store_id = ? AND day = ?`,
    userId, storeId, fechaLocalISO(now),
  );
}
