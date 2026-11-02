// tools/rutas-csv-a-plan.ts
//
// Convierte las filas del CSV "rutas_tracker" (una fila por visita: Semana N del
// mes + día) de UN mercaderista en paradas de ruta fija (route_plan_stops).
// Semana N = N-ésimo día de ese tipo en el mes (convención de las cargas viejas).
//   - 4 semanas o 3 semanas -> semanal (decisión del 2-nov: {2,3,4} pasa a semanal)
//   - 2 semanas alternas ({1,3} o {2,4}) -> cada 2
//   - 1 semana -> cada 4
// El ancla es el lunes de la primera fecha >= desde que cae en una de esas semanas,
// así la primera visita del sistema nuevo coincide con lo que pedía el CSV.

export interface FilaCsv { pdv: string; store_id: string; semana: number; dia: number; orden: number }
export interface ParadaPlan { pdv: string; store_id: string; weekday: number; position: number; every_n_weeks: number; anchor_monday: string }

const DIA_MS = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const lunesDe = (d: Date) => new Date(d.getTime() - (((d.getUTCDay() + 6) % 7) * DIA_MS));

export function frecuencia(semanas: number[]): number {
  const s = [...new Set(semanas)].sort();
  if (s.length >= 3) return 1;
  if (s.length === 1) return 4;
  if (s[1] - s[0] === 2) return 2;
  throw new Error(`Semanas ${s.join(",")} no encajan en ninguna frecuencia`);
}

export function ancla(semanas: number[], weekday: number, desde: string, n: number): string {
  const d0 = new Date(desde + "T00:00:00Z");
  if (n === 1) return iso(lunesDe(d0));
  for (let i = 0; i < 70; i++) {
    const d = new Date(d0.getTime() + i * DIA_MS);
    const nth = Math.ceil(d.getUTCDate() / 7);
    if (((d.getUTCDay() + 6) % 7) + 1 === weekday && nth <= 4 && semanas.includes(nth)) return iso(lunesDe(d));
  }
  throw new Error("Sin ancla");
}

export function planDesdeFilas(filas: FilaCsv[], desde: string): ParadaPlan[] {
  const grupos = new Map<string, FilaCsv[]>();
  for (const f of filas) {
    const k = `${f.dia}|${f.store_id}`; // la misma tienda dos veces el mismo día cuenta una
    (grupos.get(k) ?? grupos.set(k, []).get(k)!).push(f);
  }
  const out: ParadaPlan[] = [];
  for (const g of grupos.values()) {
    const semanas = g.map((f) => f.semana);
    const n = frecuencia(semanas);
    const primera = [...g].sort((a, b) => a.semana - b.semana || a.orden - b.orden)[0];
    out.push({ pdv: primera.pdv, store_id: primera.store_id, weekday: primera.dia, position: primera.orden * 10 + primera.semana,
      every_n_weeks: n, anchor_monday: ancla(semanas, primera.dia, desde, n) });
  }
  // position provisional = orden de la primera semana en que aparece; se renumera 1..n por día
  for (let dia = 1; dia <= 5; dia++)
    out.filter((p) => p.weekday === dia).sort((a, b) => a.position - b.position || a.pdv.localeCompare(b.pdv))
      .forEach((p, i) => { p.position = i + 1; });
  return out.sort((a, b) => a.weekday - b.weekday || a.position - b.position);
}
