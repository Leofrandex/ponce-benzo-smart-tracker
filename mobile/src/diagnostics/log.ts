import type { SQLiteDatabase } from 'expo-sqlite';
import type { SupabaseClient } from '@supabase/supabase-js';
import { newId } from '../services/sync/ids';
import { withDeadline } from '../utils/withTimeout';

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

// Solo los del usuario de la sesión: los de otra cuenta los rechaza RLS y, por ir
// primero en el LIMIT, tapaban para siempre los del usuario actual.
export async function flushDeviceLogs(db: SQLiteDatabase, supabase: SupabaseClient, userId: string): Promise<number> {
  const rows = await db.getAllAsync<{ log_id: string; user_id: string | null; ts: string; level: string; event: string; detail: string | null }>(
    `SELECT log_id, user_id, ts, level, event, detail FROM sync_log WHERE synced = 0 AND user_id = ? LIMIT 200`,
    userId,
  );
  let pushed = 0;
  for (const r of rows) {
    try {
      const { error } = await withDeadline(
        supabase.from('device_logs').upsert(
          { log_id: r.log_id, user_id: r.user_id, ts: r.ts, level: r.level, event: r.event, detail: r.detail },
          { onConflict: 'log_id' },
        ),
        15_000, `log ${r.log_id}`,
      );
      if (error) throw error;
      await db.runAsync(`UPDATE sync_log SET synced = 1 WHERE log_id = ?`, r.log_id);
      pushed++;
    } catch { break; /* sin red no vale la pena seguir: reintenta en el próximo flush */ }
  }
  return pushed;
}
