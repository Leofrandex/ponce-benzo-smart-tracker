// tools/ingesta/stageChains.ts
import { SupabaseClient } from "@supabase/supabase-js";
import { TiendaRow } from "./parseTiendas";
import { prefixForClient, channelForCanal, normClient } from "./tiendasConfig";

export async function stageChains(
  supabase: SupabaseClient, completas: TiendaRow[], commit: boolean,
): Promise<Map<string, { client_id: string | null; channel: string }>> {
  // Cliente representativo por normClient: primer canal visto.
  const wanted = new Map<string, { name: string; channel: string }>();
  for (const r of completas) {
    const key = normClient(r.cliente);
    if (prefixForClient(r.cliente) == null)
      throw new Error(`Cliente sin prefijo mapeado: "${r.cliente}" (fila ${r.rowIndex + 1})`);
    if (!wanted.has(key)) wanted.set(key, { name: r.cliente, channel: channelForCanal(r.canal) });
  }

  const { data: existing, error } = await supabase.from("clients").select("client_id, name");
  if (error) throw new Error(`select clients: ${error.message}`);
  const idByNorm = new Map<string, string>();
  for (const c of existing ?? []) idByNorm.set(normClient(c.name), c.client_id);

  const result = new Map<string, { client_id: string | null; channel: string }>();
  let created = 0;
  for (const [key, { name, channel }] of wanted) {
    const existingId = idByNorm.get(key) ?? null;
    if (existingId) { result.set(key, { client_id: existingId, channel }); continue; }
    if (commit) {
      const { data: ins, error: iErr } = await supabase.from("clients")
        .insert({ name, business_channel: channel, active: true }).select("client_id").single();
      if (iErr) throw new Error(`insert client ${name}: ${iErr.message}`);
      result.set(key, { client_id: (ins as { client_id: string }).client_id, channel });
    } else {
      result.set(key, { client_id: null, channel });
    }
    created++;
  }
  console.log(`✓ Cadenas: ${wanted.size} en archivo, ${created} ${commit ? "creadas" : "a crear (dry-run)"}.`);
  return result;
}
