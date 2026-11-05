import { getSupabaseBrowser } from "../supabase/client";
import type { ClienteInput } from "../types";

// fn_crear_cliente lanza 23505 con mensaje en español si el nombre o el RIF ya existen.
export async function createClient(input: ClienteInput): Promise<{ error: string | null; client_id?: string }> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.rpc("fn_crear_cliente", {
    p_name: input.name.trim(),
    p_channel: input.business_channel,
    p_rif: input.rif?.trim() || null,
    p_vendedor: input.vendedor_id || null,
  });
  if (error) return { error: error.message };
  return { error: null, client_id: data as string };
}
