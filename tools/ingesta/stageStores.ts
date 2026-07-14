// tools/ingesta/stageStores.ts
import * as path from "path";
import { SupabaseClient } from "@supabase/supabase-js";
import { parseRutas, uniqueStores } from "./parseRutas";
import { channelForStore, storeKey } from "./helpers";

const DEFAULT_LAT = 10.4806;
const DEFAULT_LNG = -66.9036;

// Devuelve mapa storeKey -> store_id (creando las tiendas que falten). Idempotente.
export async function stageStores(supabase: SupabaseClient): Promise<Map<string, string>> {
  const rutasPath = path.join(__dirname, "../../datos/fuentes/rutas.xlsx");
  const names = uniqueStores(parseRutas(rutasPath));

  // 1. Tiendas existentes -> mapa por clave normalizada.
  const byKey = new Map<string, string>();
  const { data: existing, error: selErr } = await supabase.from("stores").select("store_id, name");
  if (selErr) throw new Error(`select stores: ${selErr.message}`);
  for (const s of existing ?? []) byKey.set(storeKey(s.name), s.store_id);

  // 2. Insertar las que falten.
  const toInsert = names
    .filter((n) => !byKey.has(storeKey(n)))
    .map((n) => ({
      name: n,
      business_channel: channelForStore(n),
      master_lat: DEFAULT_LAT,
      master_lng: DEFAULT_LNG,
      active: true,
    }));

  if (toInsert.length > 0) {
    const { data: inserted, error: insErr } = await supabase
      .from("stores").insert(toInsert).select("store_id, name");
    if (insErr) throw new Error(`insert stores: ${insErr.message}`);
    for (const s of inserted ?? []) byKey.set(storeKey(s.name), s.store_id);
    console.log(`  + ${inserted!.length} tiendas creadas.`);
  }

  console.log(`✓ Tiendas: ${names.length} en total (clave única por nombre).`);
  return byKey;
}
