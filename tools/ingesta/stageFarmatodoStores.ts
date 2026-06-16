import * as path from "path";
import { SupabaseClient } from "@supabase/supabase-js";
import { parseFarmatodo } from "./parseFarmatodo";
import { normalizeBranch } from "./chains";

const ALIAS: Record<string, string> = {
  "EL AVILA": "FTD AVILA", "CLAVELINAS": "FTD CLAVELINA", "JOYA": "FTD LA JOYA",
  "MONJES": "FTD LOS MONJES", "LA CASTELLANA VE": "FTD LA CASTELLANA",
  "EXPRESO": "FTD BARUTA C.C EXPRESO", "RIOFARO": "TDF RIO FARO",
};
export async function stageFarmatodoStores(supabase: SupabaseClient): Promise<Set<string>> {
  const rows = parseFarmatodo(path.join(__dirname, "../../coordenadas-farmatodo.xlsx"));
  const { data: stores, error } = await supabase.from("stores").select("store_id, name");
  if (error) throw new Error(`select stores: ${error.message}`);
  const byBranch = new Map<string, { store_id: string; name: string }>();
  const byExact = new Map<string, { store_id: string; name: string }>();
  for (const s of stores ?? []) {
    byExact.set(s.name.toUpperCase(), s);
    const k = normalizeBranch(s.name);
    if (!byBranch.has(k)) byBranch.set(k, s);
  }
  const { data: fcli } = await supabase.from("clients").select("client_id").eq("name", "Farmatodo").maybeSingle();
  const farmatodoId = (fcli as { client_id: string } | null)?.client_id ?? null;

  const pilot = new Set<string>();
  let created = 0, updated = 0, contacts = 0;
  for (const r of rows) {
    const aliasName = ALIAS[r.nombreTienda];
    let store = aliasName ? byExact.get(aliasName.toUpperCase()) : byBranch.get(normalizeBranch(r.nombreTienda));
    const payload = {
      master_lat: r.lat, master_lng: r.lng, address: r.direccion, municipio: r.municipio,
      ciudad: r.ciudad, estado: r.estado, region: r.region, business_channel: "farmacia",
      client_id: farmatodoId, active: true,
    };
    if (store) {
      const { error: uErr } = await supabase.from("stores").update(payload).eq("store_id", store.store_id);
      if (uErr) throw new Error(`update ${store.name}: ${uErr.message}`);
      updated++;
    } else {
      const newName = `FTD ${r.nombreTienda}`;
      const { data: ins, error: iErr } = await supabase.from("stores")
        .insert({ name: newName, ...payload }).select("store_id, name").single();
      if (iErr) throw new Error(`insert ${newName}: ${iErr.message}`);
      store = ins as { store_id: string; name: string };
      byBranch.set(normalizeBranch(store.name), store);
      created++;
    }
    pilot.add(store.store_id);
    if (r.encargado) {
      const { data: prim } = await supabase.from("contacts").select("contact_id")
        .eq("store_id", store.store_id).eq("is_primary", true).eq("active", true).maybeSingle();
      const cp = { store_id: store.store_id, full_name: r.encargado, role_title: "Encargado",
        phone: r.telefono, email: r.email, birthday: r.birthday, is_primary: true, active: true };
      if (prim) {
        const { error: e } = await supabase.from("contacts").update(cp).eq("contact_id", (prim as { contact_id: string }).contact_id);
        if (e) throw new Error(`update contact ${r.encargado}: ${e.message}`);
      } else {
        const { error: e } = await supabase.from("contacts").insert(cp);
        if (e) throw new Error(`insert contact ${r.encargado}: ${e.message}`);
      }
      contacts++;
    }
  }
  console.log(`✓ Farmatodo tiendas: ${updated} actualizadas, ${created} creadas, ${contacts} encargados. Piloto=${pilot.size}.`);
  return pilot;
}
