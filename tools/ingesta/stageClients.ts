import { SupabaseClient } from "@supabase/supabase-js";
import { chainForStore, channelForChain } from "./chains";

export async function stageClients(supabase: SupabaseClient): Promise<void> {
  const { data: stores, error } = await supabase.from("stores").select("store_id, name, client_id");
  if (error) throw new Error(`select stores: ${error.message}`);
  const cadenas = new Set<string>();
  for (const s of stores ?? []) { const c = chainForStore(s.name); if (c) cadenas.add(c); }

  const byName = new Map<string, string>();
  const { data: ex, error: cErr } = await supabase.from("clients").select("client_id, name");
  if (cErr) throw new Error(`select clients: ${cErr.message}`);
  for (const c of ex ?? []) byName.set(c.name, c.client_id);

  const toInsert = [...cadenas].filter((n) => !byName.has(n))
    .map((n) => ({ name: n, business_channel: channelForChain(n), active: true }));
  if (toInsert.length) {
    const { data: ins, error: iErr } = await supabase.from("clients").insert(toInsert).select("client_id, name");
    if (iErr) throw new Error(`insert clients: ${iErr.message}`);
    for (const c of ins ?? []) byName.set(c.name, c.client_id);
    console.log(`  + ${ins!.length} clientes (cadenas) creados.`);
  }
  let upd = 0;
  for (const s of stores ?? []) {
    const cadena = chainForStore(s.name);
    const target = cadena ? byName.get(cadena) ?? null : null;
    if (s.client_id === target) continue;
    const { error: uErr } = await supabase.from("stores").update({ client_id: target }).eq("store_id", s.store_id);
    if (uErr) throw new Error(`update store ${s.name}: ${uErr.message}`);
    upd++;
  }
  console.log(`✓ Clientes: ${byName.size} cadenas; ${upd} tiendas (re)asignadas.`);
}
