import { getSupabaseBrowser } from "../supabase/client";
import type { Frecuencia, Parada, Version, Weekday } from "../rutas/plan";
import { fetchAllPages } from "./paginate";

// Plantilla de ruta fija semanal por mercaderista (route_plans + route_plan_stops).

export type TiendaBuscable = { store_id: string; name: string; client_name: string | null; zona: string | null; active: boolean };

type StopRow = { weekday: number; position: number; store_id: string; every_n_weeks: number; anchor_monday: string };
type PlanRow = { plan_id: string; effective_from: string; created_at: string; route_plan_stops: StopRow[] };

export async function fetchVersiones(userId: string): Promise<Version[]> {
  const { data, error } = await getSupabaseBrowser()
    .from("route_plans")
    .select("plan_id, effective_from, created_at, route_plan_stops(weekday, position, store_id, every_n_weeks, anchor_monday)")
    .eq("user_id", userId)
    .order("effective_from", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as PlanRow[]).map((p) => ({
    plan_id: p.plan_id,
    effective_from: p.effective_from,
    created_at: p.created_at, // string tal cual: la RPC lo compara a microsegundos
    stops: p.route_plan_stops
      .map((s): Parada => ({
        weekday: s.weekday as Weekday,
        position: s.position,
        store_id: s.store_id,
        every_n_weeks: s.every_n_weeks as Frecuencia,
        anchor_monday: s.anchor_monday,
      }))
      .sort((a, b) => a.weekday - b.weekday || a.position - b.position),
  }));
}

type StoreRow = {
  store_id: string; name: string; urbanizacion: string | null; municipio: string | null; active: boolean;
  clients: { name: string } | null;
};

export async function fetchTiendasBuscables(): Promise<TiendaBuscable[]> {
  const sb = getSupabaseBrowser();
  const rows = await fetchAllPages<StoreRow>(async (from, to) => {
    const { data, error } = await sb
      .from("stores")
      .select("store_id, name, urbanizacion, municipio, active, clients(name)")
      .order("store_id")
      .range(from, to);
    if (error) throw error;
    return (data ?? []) as unknown as StoreRow[];
  });
  return rows.map((s) => ({
    store_id: s.store_id,
    name: s.name,
    client_name: s.clients?.name ?? null,
    zona: s.urbanizacion ?? s.municipio,
    active: s.active,
  }));
}

export async function fetchUsuariosConPlan(): Promise<Set<string>> {
  const rows = await fetchAllPages<{ user_id: string }>(async (from, to) => {
    const { data, error } = await getSupabaseBrowser().from("route_plans").select("user_id").order("plan_id").range(from, to);
    if (error) throw error;
    return (data ?? []) as { user_id: string }[];
  });
  return new Set(rows.map((r) => r.user_id));
}

export async function guardarRuta(
  userId: string,
  versiones: Pick<Version, "effective_from" | "stops">[],
  versionEsperada: string | null,
): Promise<void> {
  const { error } = await getSupabaseBrowser().rpc("fn_guardar_ruta", {
    p_user_id: userId,
    p_versiones: versiones.map((v) => ({ effective_from: v.effective_from, stops: v.stops })),
    p_version_esperada: versionEsperada,
  });
  if (error) throw new Error(error.message); // mensaje en español del servidor, se muestra tal cual
}

// Máximo created_at, devuelto como el string original (nunca vía Date: perdería los microsegundos).
// Mismo formato/offset de PostgREST en todas las filas, así que el orden léxico es el cronológico.
export function ultimaVersionVista(versiones: Version[]): string | null {
  let max: string | null = null;
  for (const v of versiones) if (v.created_at && (max === null || v.created_at > max)) max = v.created_at;
  return max;
}
