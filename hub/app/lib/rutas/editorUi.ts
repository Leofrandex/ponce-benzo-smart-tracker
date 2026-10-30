import { normalizeText } from "../queries/taskFilters";
import { sumarDias } from "../queries/rutas";
import type { TiendaBuscable } from "../queries/rutaPlan";
import { aplicarDiff, diffPlan, type Parada, type Version } from "./plan";

// Piezas puras del editor de ruta fija (formato, búsqueda y armado del guardado).

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const partes = (ymd: string) => ({ dia: Number(ymd.slice(8, 10)), mes: MESES[Number(ymd.slice(5, 7)) - 1] });

// "16 nov"
export function fechaCorta(ymd: string): string {
  const { dia, mes } = partes(ymd);
  return `${dia} ${mes}`;
}

// Lunes a viernes: "16 – 20 nov", o "30 nov – 4 dic" si cruza de mes.
export function rangoSemana(lunes: string): string {
  const a = partes(lunes);
  const b = partes(sumarDias(lunes, 4));
  return a.mes === b.mes ? `${a.dia} – ${b.dia} ${b.mes}` : `${a.dia} ${a.mes} – ${b.dia} ${b.mes}`;
}

// Tiendas activas que no están ya en el día, filtradas por nombre, cliente o zona.
export function buscarTiendas(tiendas: TiendaBuscable[], q: string, yaEnDia: Set<string>, max = 8): TiendaBuscable[] {
  const n = normalizeText(q).trim();
  if (!n) return [];
  return tiendas
    .filter((t) => t.active && !yaEnDia.has(t.store_id))
    .filter((t) => [t.name, t.client_name, t.zona].some((x) => normalizeText(x).includes(n)))
    .slice(0, max);
}

// La versión editada, y si se pide, el mismo cambio aplicado a cada versión futura.
export function armarVersionesAGuardar(
  base: Parada[], stops: Parada[], effectiveFrom: string, futuras: Version[], aplicarAFuturas: boolean,
): Pick<Version, "effective_from" | "stops">[] {
  const primera = { effective_from: effectiveFrom, stops };
  if (!aplicarAFuturas || futuras.length === 0) return [primera];
  const diff = diffPlan(base, stops);
  return [primera, ...futuras.map((f) => ({ effective_from: f.effective_from, stops: aplicarDiff(f.stops, diff) }))];
}
