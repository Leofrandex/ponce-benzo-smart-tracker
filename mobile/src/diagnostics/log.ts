import type { SQLiteDatabase } from 'expo-sqlite';
import { newId } from '../services/sync/ids';

export function formatLogLine(row: { ts: string; level: string; event: string; detail: string | null }): string {
  const hora = row.ts.slice(11, 19);
  return `${hora} ${row.level.toUpperCase()} ${row.event}${row.detail ? ` · ${row.detail}` : ''}`;
}

export async function logEvent(
  db: SQLiteDatabase,
  level: 'info' | 'warn' | 'error',
  event: string,
  detail?: string,
  userId?: string,
): Promise<void> {
  try {
    await db.runAsync(
      `INSERT INTO sync_log (log_id, ts, level, event, detail, user_id) VALUES (?, ?, ?, ?, ?, ?)`,
      newId(), new Date().toISOString(), level, event, detail ?? null, userId ?? null,
    );
  } catch { /* el log nunca debe tumbar la app */ }
}
