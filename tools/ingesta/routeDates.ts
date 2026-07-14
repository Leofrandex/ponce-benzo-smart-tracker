// tools/ingesta/routeDates.ts

// weekday: 1=Lunes .. 7=Domingo. month0: 0=Enero .. 11=Diciembre.
// Devuelve la N-ésima aparición de ese día en el mes, o null si no existe.
export function nthWeekdayOfMonth(
  year: number, month0: number, weekday: number, n: number,
): Date | null {
  const jsTarget = weekday === 7 ? 0 : weekday; // JS: 0=Dom..6=Sab
  const first = new Date(Date.UTC(year, month0, 1));
  const firstDow = first.getUTCDay();
  const day = 1 + ((jsTarget - firstDow + 7) % 7) + (n - 1) * 7;
  const d = new Date(Date.UTC(year, month0, day));
  return d.getUTCMonth() === month0 ? d : null;
}

export interface Schedule { weekdays: number[]; weeks: number[]; }

// Todas las fechas ISO (YYYY-MM-DD) del schedule dentro de [from, to] inclusive.
export function generateRouteDates(sch: Schedule, from: Date, to: Date): string[] {
  const out = new Set<string>();
  const startY = from.getUTCFullYear(), endY = to.getUTCFullYear();
  for (let y = startY; y <= endY; y++) {
    const m0 = y === startY ? from.getUTCMonth() : 0;
    const m1 = y === endY ? to.getUTCMonth() : 11;
    for (let m = m0; m <= m1; m++)
      for (const w of sch.weekdays)
        for (const n of sch.weeks) {
          const d = nthWeekdayOfMonth(y, m, w, n);
          if (d && d >= from && d <= to) out.add(d.toISOString().slice(0, 10));
        }
  }
  return [...out].sort();
}
