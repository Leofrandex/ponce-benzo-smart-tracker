import * as path from "path";
import { SupabaseClient } from "@supabase/supabase-js";
import { parseFarmatodo } from "./parseFarmatodo";
import { normalizeBranch } from "./chains";

const MERCH_EMAIL: Record<string, string> = {
  "WILLIAN FERMAN": "wfermin@ponce-benzo.com",
  "CARLOS ZURITA": "czurita@ponce-benzo.com",
  "ELVIS RONDON": "erondon@ponce-benzo.com",
  "EDUWARD MARTINEZ": "emartinez@ponce-benzo.com",
  "JONATHAN FERNANDEZ": "jfernandez@ponce-benzo.com",
};
const HORIZON_WEEKS = 4;
function mondayUTC(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = x.getUTCDay();
  x.setUTCDate(x.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return x;
}
export async function stageFarmatodoRoutes(supabase: SupabaseClient, pilot: Set<string>): Promise<void> {
  const { data: users, error: uErr } = await supabase.from("users").select("id, email");
  if (uErr) throw new Error(`select users: ${uErr.message}`);
  const idByEmail = new Map<string, string>();
  for (const u of users ?? []) idByEmail.set(u.email.toLowerCase(), u.id);

  const { data: stores, error: sErr } = await supabase.from("stores").select("store_id, name");
  if (sErr) throw new Error(`select stores: ${sErr.message}`);
  const idByBranch = new Map<string, string>();
  for (const s of stores ?? []) if (pilot.has(s.store_id)) idByBranch.set(normalizeBranch(s.name), s.store_id);

  const rows = parseFarmatodo(path.join(__dirname, "../../coordenadas-farmatodo.xlsx"));
  const ALIAS: Record<string, string> = { "EL AVILA":"AVILA","CLAVELINAS":"CLAVELINA","JOYA":"LA JOYA","MONJES":"LOS MONJES","LA CASTELLANA VE":"LA CASTELLANA","EXPRESO":"BARUTA C.C EXPRESO","RIOFARO":"RIO FARO" };
  const plan = new Map<string, Map<number, string[]>>();
  for (const r of rows) {
    const email = MERCH_EMAIL[r.merch]; if (!email) { console.warn(`⚠ Mercaderista sin mapear: "${r.merch}"`); continue; }
    const userId = idByEmail.get(email.toLowerCase()); if (!userId) { console.warn(`⚠ Sin user id para ${email}`); continue; }
    const branch = ALIAS[r.nombreTienda] ?? r.nombreTienda;
    const storeId = idByBranch.get(normalizeBranch(branch)) ?? idByBranch.get(normalizeBranch(r.nombreTienda));
    if (!storeId) { console.warn(`⚠ Tienda piloto no encontrada: "${r.nombreTienda}"`); continue; }
    if (!plan.has(userId)) plan.set(userId, new Map());
    const byDay = plan.get(userId)!;
    for (const wd of r.weekdays) { if (!byDay.has(wd)) byDay.set(wd, []); byDay.get(wd)!.push(storeId); }
  }
  const base = mondayUTC(new Date());
  const routeRows: { user_id: string; route_date: string; store_ids: string[] }[] = [];
  for (const [userId, byDay] of plan)
    for (const [wd, storeIds] of byDay)
      for (let w = 0; w < HORIZON_WEEKS; w++) {
        const d = new Date(base); d.setUTCDate(base.getUTCDate() + w * 7 + (wd - 1));
        routeRows.push({ user_id: userId, route_date: d.toISOString().slice(0, 10), store_ids: storeIds });
      }
  const { error: delErr } = await supabase.from("routes").delete().neq("route_id", "00000000-0000-0000-0000-000000000000");
  if (delErr) throw new Error(`delete routes: ${delErr.message}`);
  if (routeRows.length) {
    const { error: insErr } = await supabase.from("routes").insert(routeRows);
    if (insErr) throw new Error(`insert routes: ${insErr.message}`);
  }
  console.log(`✓ Rutas Farmatodo: ${routeRows.length} (${plan.size} mercaderistas, horizonte ${HORIZON_WEEKS} semanas).`);
}
