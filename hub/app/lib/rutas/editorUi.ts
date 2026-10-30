import { normalizeText } from "../queries/taskFilters";
import { sumarDias } from "../queries/rutas";
import type { TiendaBuscable } from "../queries/rutaPlan";
import { aplicarDiff, diffPlan, versionVigente, type Parada, type Version } from "./plan";

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

// El editor arranca desde la versión vigente en la fecha "aplica desde".
export function baseParaFecha(versiones: Version[], fecha: string): Parada[] {
  return versionVigente(versiones, fecha)?.stops ?? [];
}

export type AvisoFecha = { tipo: "reemplaza" | "rige-antes"; fecha: string } | null;

// Cambios armados sobre la ruta vigente en `fechaBase` y movidos a `fecha`: ¿queda una versión
// programada en medio? Igual a `fecha` → guardar la reemplaza; antes de `fecha` → rige antes.
export function avisoFecha(versiones: Version[], fechaBase: string, fecha: string): AvisoFecha {
  let ultima: string | null = null;
  for (const v of versiones) {
    if (v.effective_from > fechaBase && v.effective_from <= fecha && (!ultima || v.effective_from > ultima)) ultima = v.effective_from;
  }
  return ultima ? { tipo: ultima === fecha ? "reemplaza" : "rige-antes", fecha: ultima } : null;
}

// Rechazo del guardado porque otra persona guardó antes (ver fn_guardar_ruta).
export const esConflictoVersion = (mensaje: string) => mensaje.startsWith("La ruta cambió mientras la editabas");

// La versión editada, y si se pide, el mismo cambio aplicado a cada versión futura.
export function armarVersionesAGuardar(
  base: Parada[], stops: Parada[], effectiveFrom: string, futuras: Version[], aplicarAFuturas: boolean,
): Pick<Version, "effective_from" | "stops">[] {
  const primera = { effective_from: effectiveFrom, stops };
  if (!aplicarAFuturas || futuras.length === 0) return [primera];
  const diff = diffPlan(base, stops);
  return [primera, ...futuras.map((f) => ({ effective_from: f.effective_from, stops: aplicarDiff(f.stops, diff) }))];
}
