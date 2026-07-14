// tools/ingesta/stageStoresMulti.ts
import { SupabaseClient } from "@supabase/supabase-js";
import { TiendaRow, resolveStoreNames } from "./parseTiendas";
import { prefixForClient, normClient } from "./tiendasConfig";

export function storeKeyFor(r: TiendaRow): string {
  return `${normClient(r.cliente)}|${r.lat!.toFixed(5)},${r.lng!.toFixed(5)}`;
}

export async function stageStoresMulti(
  supabase: SupabaseClient,
  completas: TiendaRow[],
  chainMap: Map<string, { client_id: string | null; channel: string }>,
  commit: boolean,
): Promise<{ pilot: Set<string>; idByKey: Map<string, string | null> }> {
  // Nombres finales con desempate de homónimos.
  const names = resolveStoreNames(completas.map((r) => ({
    prefix: prefixForClient(r.cliente)!, nombre: r.nombreTienda, municipio: r.municipio,
  })));

  // Índice de tiendas existentes por (client_id + coord redondeada).
  const { data: existing, error } = await supabase
    .from("stores").select("store_id, client_id, master_lat, master_lng");
  if (error) throw new Error(`select stores: ${error.message}`);
  const existingByKey = new Map<string, string>();
  for (const s of existing ?? []) {
    if (s.client_id == null || s.master_lat == null || s.master_lng == null) continue;
    existingByKey.set(`${s.client_id}|${Number(s.master_lat).toFixed(5)},${Number(s.master_lng).toFixed(5)}`, s.store_id);
  }

  const pilot = new Set<string>();
  const idByKey = new Map<string, string | null>();
  let created = 0, updated = 0, contacts = 0;

  for (let i = 0; i < completas.length; i++) {
    const r = completas[i];
    const chain = chainMap.get(normClient(r.cliente))!;
    const key = storeKeyFor(r);
    const payload = {
      name: names[i], master_lat: r.lat, master_lng: r.lng, address: r.direccion,
      municipio: r.municipio, ciudad: r.ciudad, estado: r.estado, region: r.region,
      business_channel: chain.channel, client_id: chain.client_id, active: true,
    };
    const dbKey = chain.client_id ? `${chain.client_id}|${r.lat!.toFixed(5)},${r.lng!.toFixed(5)}` : null;
    let storeId: string | null = dbKey ? existingByKey.get(dbKey) ?? null : null;

    if (commit) {
      if (storeId) {
        const { error: uErr } = await supabase.from("stores").update(payload).eq("store_id", storeId);
        if (uErr) throw new Error(`update ${payload.name}: ${uErr.message}`);
        updated++;
      } else {
        const { data: ins, error: iErr } = await supabase.from("stores")
          .insert(payload).select("store_id").single();
        if (iErr) throw new Error(`insert ${payload.name}: ${iErr.message}`);
        storeId = (ins as { store_id: string }).store_id;
        created++;
      }
      pilot.add(storeId);
      // Contacto primario (encargado).
      if (r.encargado) {
        const { data: prim } = await supabase.from("contacts").select("contact_id")
          .eq("store_id", storeId).eq("is_primary", true).eq("active", true).maybeSingle();
        const cp = {
          store_id: storeId, full_name: r.encargado, role_title: "Encargado",
          phone: r.telefono, email: r.email, birthday: r.birthday, is_primary: true, active: true,
        };
        if (prim) {
          const { error: e } = await supabase.from("contacts").update(cp)
            .eq("contact_id", (prim as { contact_id: string }).contact_id);
          if (e) throw new Error(`update contact ${r.encargado}: ${e.message}`);
        } else {
          const { error: e } = await supabase.from("contacts").insert(cp);
          if (e) throw new Error(`insert contact ${r.encargado}: ${e.message}`);
        }
        contacts++;
      }
    } else {
      if (storeId) updated++; else created++;
      if (r.encargado) contacts++;
    }
    idByKey.set(key, storeId);
  }
  console.log(`✓ Sucursales: ${updated} ${commit ? "actualizadas" : "a actualizar"}, ${created} ${commit ? "creadas" : "a crear"}, ${contacts} encargados. Total=${completas.length}.`);
  return { pilot, idByKey };
}
