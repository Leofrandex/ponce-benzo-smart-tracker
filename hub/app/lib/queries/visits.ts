import { getSupabaseBrowser } from "../supabase/client";
import { fetchAllPages } from "./paginate";
import type { VisitRow } from "./derive";

// Todas las visitas visibles (RLS), paginadas: deriveClientRows se queda con
// la más reciente por tienda. ~4.000 filas hoy → 4-5 páginas.
export async function fetchUltimasVisitas(): Promise<VisitRow[]> {
  const sb = getSupabaseBrowser();
  return fetchAllPages<VisitRow>(async (from, to) => {
    const { data, error } = await sb
      .from("visits")
      .select("visit_id, store_id, check_in_time, status")
      .order("check_in_time", { ascending: false })
      .order("visit_id", { ascending: true })
      .range(from, to);
    if (error) throw error;
    return (data ?? []) as VisitRow[];
  });
}
