import { normalizeText } from "../queries/taskFilters";
import { lunesDe, sumarDias } from "../queries/rutas";
import type { TiendaBuscable } from "../queries/rutaPlan";
import { paradasDelDia, versionVigente, type Parada, type Version, type Weekday } from "./plan";

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

// Número de orden de cada parada en `fecha`, como lo materializa el servidor: nada antes de que
// rija la ruta (`desde`) y sin contar sucursales inactivas.
export function numerosDelDia(stops: Parada[], fecha: string, desde: string, activa: (storeId: string) => boolean): Map<string, number> {
  if (fecha < desde) return new Map();
  return new Map(paradasDelDia(stops, fecha).filter((p) => activa(p.store_id)).map((p, i) => [p.store_id, i + 1]));
}

// Rechazo del guardado porque otra persona guardó antes (ver fn_guardar_ruta).
export const esConflictoVersion = (mensaje: string) => mensaje.startsWith("La ruta cambió mientras la editabas");

// El editor trabaja semana a semana: siempre la semana que viene.
export const proximoLunes = (hoy: string) => sumarDias(lunesDe(hoy), 7);

// La semana `lunes` tal como la haría el mercaderista con la ruta vigente, convertida en
// plantilla semanal: lo que toca ese día pasa a visitarse todas las semanas desde `lunes`.
export function semanaComoPlantilla(versiones: Version[], lunes: string): Parada[] {
  return ([1, 2, 3, 4, 5] as Weekday[]).flatMap((w) => {
    const fecha = sumarDias(lunes, w - 1);
    return paradasDelDia(versionVigente(versiones, fecha)?.stops ?? [], fecha)
      .map((p, i): Parada => ({ ...p, position: i + 1, every_n_weeks: 1, anchor_monday: lunes }));
  });
}

// Lo guardado rige desde `lunes` en adelante: también pisa las versiones ya programadas después.
export function versionesAGuardar(stops: Parada[], lunes: string, versiones: Version[]): Pick<Version, "effective_from" | "stops">[] {
  const fechas = [lunes, ...versiones.map((v) => v.effective_from).filter((f) => f > lunes)];
  return fechas.map((effective_from) => ({ effective_from, stops }));
}
