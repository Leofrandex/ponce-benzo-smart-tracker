import type { SessionRow } from '../db';

/**
 * Decide qué sesión reanudar al abrir la app.
 * Regla: la sesión abierta (session_end == null) más reciente del usuario.
 * Si no hay ninguna abierta, devuelve null (la app ofrece "Empezar Ruta").
 */
export function pickResumableSession(
  sessions: SessionRow[],
  userId: string,
): SessionRow | null {
  const open = sessions
    .filter((s) => s.user_id === userId && s.session_end == null)
    .sort((a, b) => b.session_start.localeCompare(a.session_start));
  return open[0] ?? null;
}
