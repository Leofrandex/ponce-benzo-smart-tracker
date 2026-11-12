import { getSupabaseBrowser } from "../supabase/client";
import { fetchAllPages } from "./paginate";

export type CambioGps = {
  history_id: string;
  store_id: string;
  changed_at: string;
  orden: number;
  changed_by_name: string | null; // null = sin usuario (herramienta del sistema); "—" = nombre no disponible
  old_lat: number | null;
  old_lng: number | null;
  new_lat: number | null;
  new_lng: number | null;
  kind: "captura" | "restauracion" | "edicion";
};

type Coords = { lat: number | null; lng: number | null };

// Coordenadas que tenía la tienda en `fecha`. El historial es una cadena ordenada por
// (changed_at, orden): el primer cambio estrictamente posterior a la visita trae en old_*
// lo que valía entonces. Sin cambios posteriores, rige el valor actual. Una visita justo
// en changed_at ya ve los valores nuevos de ese cambio.
export function coordenadasEn(fecha: string, actual: Coords, cambios: CambioGps[]): Coords {
  const t = Date.parse(fecha);
  let primero: CambioGps | null = null;
  for (const c of cambios) {
    if (Date.parse(c.changed_at) <= t) continue;
    if (!primero) { primero = c; continue; }
    const dt = Date.parse(c.changed_at) - Date.parse(primero.changed_at);
    if (dt < 0 || (dt === 0 && c.orden < primero.orden)) primero = c;
  }
  return primero ? { lat: primero.old_lat, lng: primero.old_lng } : actual;
}

const LOTE = 100;
const COLS = "history_id, store_id, changed_at, orden, changed_by, old_lat, old_lng, new_lat, new_lng, kind";

type Fila = Omit<CambioGps, "changed_by_name"> & { changed_by: string | null };

// Cambios de GPS de varias tiendas, ordenados por (changed_at, orden). Una falla se propaga.
// conNombres=false evita la consulta de usuarios cuando solo importan las coordenadas.
export async function fetchCambiosGps(storeIds: string[], conNombres = true): Promise<CambioGps[]> {
  const ids = Array.from(new Set(storeIds));
  if (ids.length === 0) return [];
  const sb = getSupabaseBrowser();
  const filas: Fila[] = [];
  for (let i = 0; i < ids.length; i += LOTE) {
    const lote = ids.slice(i, i + LOTE);
    filas.push(...(await fetchAllPages<Fila>(async (from, to) => {
      const { data, error } = await sb.from("store_gps_history").select(COLS)
        .in("store_id", lote)
        .order("changed_at", { ascending: true }).order("orden", { ascending: true })
        .range(from, to);
      if (error) throw error;
      return (data ?? []) as unknown as Fila[];
    })));
  }

  const nombres = new Map<string, string>();
  const userIds = Array.from(new Set(filas.map((f) => f.changed_by).filter((u): u is string => u != null)));
  if (conNombres && userIds.length > 0) {
    // El nombre es secundario: si RLS lo oculta o la consulta falla, el historial sigue.
    for (let i = 0; i < userIds.length; i += LOTE) {
      const { data } = await sb.from("users").select("id, full_name").in("id", userIds.slice(i, i + LOTE));
      for (const u of (data ?? []) as { id: string; full_name: string | null }[]) if (u.full_name) nombres.set(u.id, u.full_name);
    }
  }

  return filas.map(({ changed_by, ...f }) => ({
    ...f,
    changed_by_name: changed_by == null ? null : (nombres.get(changed_by) ?? "—"),
  }));
}

// Las coordenadas que se aplicarían al restaurar, leídas ahora: una captura tardía puede haber reescrito old_*.
export async function leerCoordenadasRestauracion(historyId: string): Promise<Coords> {
  const { data, error } = await getSupabaseBrowser().from("store_gps_history")
    .select("old_lat, old_lng").eq("history_id", historyId).single();
  if (error) throw error;
  return { lat: data.old_lat, lng: data.old_lng };
}

export async function restaurarGps(historyId: string): Promise<{ error: string | null }> {
  const { error } = await getSupabaseBrowser().rpc("fn_restaurar_gps_tienda", { p_history_id: historyId });
  return { error: error?.message ?? null };
}
