export interface VisitStatRow { check_in_time: string; status: string }

/** Hoy y semana (desde el lunes) en hora local del dispositivo; las omitidas no cuentan. */
export function visitStats(rows: VisitStatRow[], now: Date): { hoy: number; semana: number; completadas: number } {
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(dayStart);
  weekStart.setDate(dayStart.getDate() - ((dayStart.getDay() + 6) % 7)); // lunes; domingo = 6 dias atras
  const dayMs = dayStart.getTime();
  const weekMs = weekStart.getTime();
  const out = { hoy: 0, semana: 0, completadas: 0 };
  for (const r of rows) {
    if (r.status === 'skipped') continue;
    const t = new Date(r.check_in_time).getTime();
    if (t >= weekMs) { out.semana++; if (r.status === 'completed') out.completadas++; }
    if (t >= dayMs) out.hoy++;
  }
  return out;
}
