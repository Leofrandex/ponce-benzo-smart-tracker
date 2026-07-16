export type SessionLike = {
  session_id: string; user_id: string; session_start: string; session_end: string | null;
};
export type TodayState = 'NONE' | 'ACTIVE' | 'ENDED';

/**
 * Día LOCAL (YYYY-MM-DD) de un timestamp ISO UTC. `tzOffsetMin` viene de
 * Date.getTimezoneOffset() (Venezuela: +240 = UTC-4). Antes se usaba el día UTC:
 * a las 8:00 PM hora local el sistema "cambiaba de día" y una jornada activa se
 * autocerraba / las visitas de la mañana desaparecían de la ruta.
 */
export function localDayOf(iso: string, tzOffsetMin: number): string {
  return new Date(Date.parse(iso) - tzOffsetMin * 60_000).toISOString().slice(0, 10);
}

const deviceOffset = () => new Date().getTimezoneOffset();

export function resolveTodayState(
  rows: SessionLike[], userId: string, nowIso: string, tzOffsetMin: number = deviceOffset(),
): { state: TodayState; session: SessionLike | null } {
  const today = localDayOf(nowIso, tzOffsetMin);
  const todays = rows
    .filter((s) => s.user_id === userId && localDayOf(s.session_start, tzOffsetMin) === today)
    .sort((a, b) => b.session_start.localeCompare(a.session_start));
  const session = todays[0] ?? null;
  if (!session) return { state: 'NONE', session: null };
  return { state: session.session_end == null ? 'ACTIVE' : 'ENDED', session };
}

export function selectStaleOpen(
  rows: SessionLike[], userId: string, nowIso: string, tzOffsetMin: number = deviceOffset(),
): SessionLike[] {
  const today = localDayOf(nowIso, tzOffsetMin);
  return rows.filter(
    (s) => s.user_id === userId && s.session_end == null && localDayOf(s.session_start, tzOffsetMin) !== today,
  );
}
