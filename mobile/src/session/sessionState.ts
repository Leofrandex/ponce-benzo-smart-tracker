export type SessionLike = {
  session_id: string; user_id: string; session_start: string; session_end: string | null;
};
export type TodayState = 'NONE' | 'ACTIVE' | 'ENDED';

// "Hoy" en UTC (consistente con el resto del código: timestamps ISO en UTC).
function dayOf(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD
}

export function resolveTodayState(
  rows: SessionLike[], userId: string, nowIso: string,
): { state: TodayState; session: SessionLike | null } {
  const today = dayOf(nowIso);
  const todays = rows
    .filter((s) => s.user_id === userId && dayOf(s.session_start) === today)
    .sort((a, b) => b.session_start.localeCompare(a.session_start));
  const session = todays[0] ?? null;
  if (!session) return { state: 'NONE', session: null };
  return { state: session.session_end == null ? 'ACTIVE' : 'ENDED', session };
}

export function selectStaleOpen(rows: SessionLike[], userId: string, nowIso: string): SessionLike[] {
  const today = dayOf(nowIso);
  return rows.filter(
    (s) => s.user_id === userId && s.session_end == null && dayOf(s.session_start) !== today,
  );
}
