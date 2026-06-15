import { getSupabaseBrowser } from "../supabase/client";

export interface ClientRow {
  client_id: string;
  name: string;
  business_channel: string | null;
  store_count: number;
}

export async function fetchClients(): Promise<ClientRow[]> {
  const sb = getSupabaseBrowser();
  const { data: clients, error } = await sb
    .from("clients")
    .select("client_id, name, business_channel")
    .eq("active", true)
    .order("name");
  if (error) throw error;

  const { data: stores, error: sErr } = await sb
    .from("stores")
    .select("client_id")
    .eq("active", true);
  if (sErr) throw sErr;

  const counts = new Map<string, number>();
  for (const s of (stores ?? []) as { client_id: string | null }[]) {
    if (s.client_id) counts.set(s.client_id, (counts.get(s.client_id) ?? 0) + 1);
  }

  return ((clients ?? []) as { client_id: string; name: string; business_channel: string | null }[]).map((c) => ({
    client_id: c.client_id,
    name: c.name,
    business_channel: c.business_channel,
    store_count: counts.get(c.client_id) ?? 0,
  }));
}
