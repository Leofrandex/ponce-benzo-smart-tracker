import { getSupabaseBrowser } from "../supabase/client";
import { mensajeError } from "../queries/restocks";

export async function registrarReposicion(v: {
  storeId: string; fecha: string; productos: string[]; nota: string;
}): Promise<{ error: string | null }> {
  const sb = getSupabaseBrowser();
  const { error } = await sb.rpc("fn_registrar_reposicion", {
    p_store_id: v.storeId, p_fecha: v.fecha, p_productos: v.productos, p_nota: v.nota,
  });
  return { error: error ? mensajeError(error.message) : null };
}

export async function eliminarReposicion(restockId: string): Promise<{ error: string | null }> {
  const sb = getSupabaseBrowser();
  const { error, count } = await sb.from("restocks").delete({ count: "exact" }).eq("restock_id", restockId);
  if (error) return { error: mensajeError(error.message) };
  // RLS filtra el DELETE en silencio: 0 filas = no tenía permiso.
  if (count === 0) return { error: "No tienes permiso para eliminar esta reposición." };
  return { error: null };
}
