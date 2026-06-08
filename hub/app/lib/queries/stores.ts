import { getSupabaseBrowser } from "../supabase/client";
import type { Store } from "../types";

export async function fetchStores(): Promise<Store[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.from("stores").select("*").order("name");
  if (error) throw error;
  // El RLS ya filtra; las columnas de contacto del tipo Store no existen en la tabla
  // (contacts es aparte) -> se rellenan como null para compatibilidad de tipo.
  return (data ?? []).map((s: Record<string, unknown>) => ({
    contact_name: null, contact_phone: null, contact_email: null,
    ...s,
  })) as Store[];
}
