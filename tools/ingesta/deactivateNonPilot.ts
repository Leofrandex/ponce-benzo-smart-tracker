import { SupabaseClient } from "@supabase/supabase-js";
export async function deactivateNonPilot(supabase: SupabaseClient, pilot: Set<string>): Promise<void> {
  const { data: stores, error } = await supabase.from("stores").select("store_id, active");
  if (error) throw new Error(`select stores: ${error.message}`);
  let off = 0, on = 0;
  for (const s of stores ?? []) {
    const shouldBeActive = pilot.has(s.store_id);
    if (s.active === shouldBeActive) continue;
    const { error: uErr } = await supabase.from("stores").update({ active: shouldBeActive }).eq("store_id", s.store_id);
    if (uErr) throw new Error(`update store ${s.store_id}: ${uErr.message}`);
    if (shouldBeActive) on++; else off++;
  }
  console.log(`✓ Desactivacion: ${off} fuera del piloto OFF, ${on} piloto ON. Activas=${pilot.size}.`);
}
