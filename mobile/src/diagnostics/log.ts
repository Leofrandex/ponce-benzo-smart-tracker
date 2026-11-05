import type { SQLiteDatabase } from 'expo-sqlite';
import type { SupabaseClient } from '@supabase/supabase-js';
import { newId } from '../services/sync/ids';
import { withDeadline } from '../utils/withTimeout';
import { classifyError } from '../sync/errorKind';

type LogRow = { log_id: string; user_id: string | null; ts: string; level: string; event: string; detail: string | null };

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

// Solo las clases de datos (22) e integridad (23) culpan a la fila: reintentarla no sirve.
// Lo demás (base en solo lectura, statement timeout, permisos, token vencido, 5xx sin
// cuerpo) es pasajero: marcarla perdería el log sin haberlo subido.
const rowRejected = (e: unknown): boolean => {
  const code = (e as { code?: unknown } | null)?.code;
  return typeof code === 'string' && /^(22|23)/.test(code);
};

// Solo los del usuario de la sesión: los de otra cuenta los rechaza RLS y, por ir
// primero en el LIMIT, tapaban para siempre los del usuario actual.
export async function flushDeviceLogs(db: SQLiteDatabase, supabase: SupabaseClient, userId: string): Promise<number> {
  let sent = 0;
  try {
    const rows = await db.getAllAsync<LogRow>(
      `SELECT log_id, user_id, ts, level, event, detail FROM sync_log WHERE synced = 0 AND user_id = ? LIMIT 200`,
      userId,
    );
    if (rows.length === 0) return 0;
    const upsert = async (batch: LogRow[]): Promise<unknown> => {
      const { error } = await withDeadline(
        supabase.from('device_logs').upsert(
          batch.map((r) => ({ log_id: r.log_id, user_id: r.user_id, ts: r.ts, level: r.level, event: r.event, detail: r.detail })),
          { onConflict: 'log_id' },
        ),
        15_000, 'device_logs',
      );
      return error;
    };
    const mark = (batch: LogRow[]) =>
      db.runAsync(`UPDATE sync_log SET synced = 1 WHERE log_id IN (${batch.map(() => '?').join(',')})`, ...batch.map((r) => r.log_id));

    const error = await upsert(rows);
    if (!error) { await mark(rows); return rows.length; }
    if (classifyError(error) === 'network') return 0;

    // Una fila mala tumba el lote entero: uno a uno suben las demás.
    for (const r of rows) {
      const rowError = await upsert([r]);
      if (rowError && !rowRejected(rowError)) break;
      if (!rowError) sent++;
      // La rechazada también se marca: si no, bloquearía los logs para siempre.
      await mark([r]);
    }
    return sent;
  } catch { return sent; /* sin red o sin base local: lo no marcado reintenta en el próximo flush */ }
}
