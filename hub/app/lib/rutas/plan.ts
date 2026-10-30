import { lunesDe, sumarDias } from "../queries/rutas";

// Regla de visita de la ruta fija. Fechas 'YYYY-MM-DD' sin zona horaria.
// Gemela en SQL: debe coincidir con esta.

export type Weekday = 1 | 2 | 3 | 4 | 5;
export type Frecuencia = 1 | 2 | 3 | 4;
export type Parada = { weekday: Weekday; position: number; store_id: string; every_n_weeks: Frecuencia; anchor_monday: string };
export type Version = { plan_id: string | null; effective_from: string; created_at: string | null; stops: Parada[] };
export type DiffPlan = {
  altas: Parada[];
  bajas: { weekday: Weekday; store_id: string }[];
  cambios: Parada[];
  orden: Partial<Record<Weekday, string[]>>; // solo días cuyo orden cambió
};

const DIAS: Weekday[] = [1, 2, 3, 4, 5];
const clave = (weekday: number, store_id: string) => `${weekday}|${store_id}`;
const mod = (x: number, n: number) => ((x % n) + n) % n;

function semanasEntre(desdeLunes: string, hastaLunes: string): number {
  const ms = Date.parse(hastaLunes + "T00:00:00Z") - Date.parse(desdeLunes + "T00:00:00Z");
  return Math.round(ms / (7 * 86_400_000));
}

function weekdayDe(ymd: string): number {
  return new Date(ymd + "T00:00:00Z").getUTCDay(); // 0 = domingo
}

export function tocaEnFecha(p: Parada, ymd: string): boolean {
  if (weekdayDe(ymd) !== p.weekday) return false;
  return mod(semanasEntre(p.anchor_monday, lunesDe(ymd)), p.every_n_weeks) === 0;
}

export function paradasDelDia(stops: Parada[], ymd: string): Parada[] {
  return stops.filter((s) => tocaEnFecha(s, ymd)).sort((a, b) => a.position - b.position);
}

// Lunes de la primera semana laboral en que rige `ymd`: su lunes si cae lunes–viernes, si no el siguiente.
export function primerLunesDesde(ymd: string): string {
  const lunes = lunesDe(ymd);
  return weekdayDe(ymd) % 6 === 0 ? sumarDias(lunes, 7) : lunes;
}

export function opcionesSemana(effectiveFrom: string, n: Frecuencia): string[] {
  const lunes = lunesDe(effectiveFrom);
  return Array.from({ length: n }, (_, i) => sumarDias(lunes, 7 * i));
}

export function normalizarAncla(anchor: string, effectiveFrom: string, n: Frecuencia): string {
  const opciones = opcionesSemana(effectiveFrom, n);
  return opciones.find((o) => mod(semanasEntre(anchor, o), n) === 0) ?? opciones[0];
}

export function proximasVisitas(p: Parada, desde: string, k: number): string[] {
  let f = sumarDias(lunesDe(desde), p.weekday - 1);
  if (f < desde) f = sumarDias(f, 7);
  while (!tocaEnFecha(p, f)) f = sumarDias(f, 7);
  const out: string[] = [];
  for (let i = 0; i < k; i++) out.push(sumarDias(f, 7 * p.every_n_weeks * i));
  return out;
}

export function versionVigente(versiones: Version[], ymd: string): Version | null {
  let mejor: Version | null = null;
  for (const v of versiones) {
    if (v.effective_from <= ymd && (!mejor || v.effective_from > mejor.effective_from)) mejor = v;
  }
  return mejor;
}

export function versionesFuturas(versiones: Version[], effectiveFrom: string): Version[] {
  return versiones.filter((v) => v.effective_from > effectiveFrom).sort((a, b) => a.effective_from.localeCompare(b.effective_from));
}

export function diffPlan(base: Parada[], editado: Parada[]): DiffPlan {
  const enBase = new Map(base.map((s) => [clave(s.weekday, s.store_id), s]));
  const enEditado = new Map(editado.map((s) => [clave(s.weekday, s.store_id), s]));
  const altas: Parada[] = [];
  const cambios: Parada[] = [];
  for (const [k, s] of Array.from(enEditado)) {
    const antes = enBase.get(k);
    if (!antes) altas.push(s);
    else if (antes.every_n_weeks !== s.every_n_weeks || antes.anchor_monday !== s.anchor_monday) cambios.push(s);
  }
  const bajas = Array.from(enBase).filter(([k]) => !enEditado.has(k)).map(([, s]) => ({ weekday: s.weekday, store_id: s.store_id }));
  const secuencia = (ps: Parada[], w: Weekday) =>
    ps.filter((s) => s.weekday === w).sort((a, b) => a.position - b.position).map((s) => s.store_id);
  const orden: Partial<Record<Weekday, string[]>> = {};
  for (const w of DIAS) {
    const nuevo = secuencia(editado, w);
    if (nuevo.join("|") !== secuencia(base, w).join("|")) orden[w] = nuevo;
  }
  return { altas, bajas, cambios, orden };
}

export function aplicarDiff(stops: Parada[], diff: DiffPlan): Parada[] {
  const out: Parada[] = [];
  for (const weekday of DIAS) {
    const bajas = new Set(diff.bajas.filter((b) => b.weekday === weekday).map((b) => b.store_id));
    const cambios = new Map(diff.cambios.filter((c) => c.weekday === weekday).map((c) => [c.store_id, c]));
    const dia = new Map<string, Parada>();
    for (const s of stops.filter((x) => x.weekday === weekday).sort((a, b) => a.position - b.position)) {
      if (bajas.has(s.store_id)) continue;
      const c = cambios.get(s.store_id);
      dia.set(s.store_id, c ? { ...s, every_n_weeks: c.every_n_weeks, anchor_monday: c.anchor_monday } : s);
    }
    for (const a of diff.altas.filter((x) => x.weekday === weekday).sort((x, y) => x.position - y.position)) dia.set(a.store_id, a);
    const primeras = (diff.orden[weekday] ?? []).filter((id) => dia.has(id));
    const orden = [...primeras, ...Array.from(dia.keys()).filter((id) => !primeras.includes(id))];
    orden.forEach((id, i) => out.push({ ...dia.get(id)!, weekday, position: i + 1 }));
  }
  return out;
}
