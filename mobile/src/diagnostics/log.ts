import type { SQLiteDatabase } from 'expo-sqlite';
import type { SupabaseClient } from '@supabase/supabase-js';
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

export async function flushDeviceLogs(db: SQLiteDatabase, supabase: SupabaseClient): Promise<number> {
  const rows = await db.getAllAsync<{ log_id: string; user_id: string | null; ts: string; level: string; event: string; detail: string | null }>(
    `SELECT log_id, user_id, ts, level, event, detail FROM sync_log WHERE synced = 0 AND user_id IS NOT NULL LIMIT 200`,
  );
  let pushed = 0;
  for (const r of rows) {
    try {
      const { error } = await supabase.from('device_logs').upsert(
        { log_id: r.log_id, user_id: r.user_id, ts: r.ts, level: r.level, event: r.event, detail: r.detail },
        { onConflict: 'log_id' },
      );
      if (error) throw error;
      await db.runAsync(`UPDATE sync_log SET synced = 1 WHERE log_id = ?`, r.log_id);
      pushed++;
    } catch { /* reintenta en el próximo flush */ }
  }
  return pushed;
}
