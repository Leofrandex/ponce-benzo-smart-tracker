// tools/ingesta/stageRoutesMulti.ts
import { SupabaseClient } from "@supabase/supabase-js";
import { TiendaRow } from "./parseTiendas";
import { storeKeyFor } from "./stageStoresMulti";
import { generateRouteDates } from "./routeDates";

const MERCH_EMAIL: Record<string, string> = {
  "WILLIAN FERMAN": "wfermin@ponce-benzo.com",
  "CARLOS ZURITA": "czurita@ponce-benzo.com",
  "ELVIS RONDON": "erondon@ponce-benzo.com",
  "EDUWARD MARTINEZ": "emartinez@ponce-benzo.com",
  "JONATHAN FERNANDEZ": "jfernandez@ponce-benzo.com",
};

export async function stageRoutesMulti(
  supabase: SupabaseClient, completas: TiendaRow[], idByKey: Map<string, string | null>,
  from: Date, to: Date, commit: boolean,
): Promise<void> {
  const { data: users, error: uErr } = await supabase.from("users").select("id, email");
  if (uErr) throw new Error(`select users: ${uErr.message}`);
  const idByEmail = new Map<string, string>();
  for (const u of users ?? []) idByEmail.set(u.email.toLowerCase(), u.id);

  // (user_id, route_date) -> Set<store_id>
  const plan = new Map<string, Set<string>>();
  let skipped = 0;
  for (const r of completas) {
    const email = MERCH_EMAIL[r.merch];
    if (!email) { console.warn(`⚠ Mercaderista sin mapear: "${r.merch}"`); skipped++; continue; }
    const userId = idByEmail.get(email.toLowerCase());
    if (!userId) { console.warn(`⚠ Sin user id para ${email}`); skipped++; continue; }
    const storeId = idByKey.get(storeKeyFor(r));
    if (!storeId) { if (commit) console.warn(`⚠ Tienda sin id: ${r.nombreTienda}`); continue; }
    for (const date of generateRouteDates({ weekdays: r.weekdays, weeks: r.weeks }, from, to)) {
      const k = `${userId}|${date}`;
      if (!plan.has(k)) plan.set(k, new Set());
      plan.get(k)!.add(storeId);
    }
  }

  const routeRows = [...plan.entries()].map(([k, ids]) => {
    const [user_id, route_date] = k.split("|");
    return { user_id, route_date, store_ids: [...ids] };
  });
  const totalVisits = routeRows.reduce((s, r) => s + r.store_ids.length, 0);

  if (commit) {
    const { error: delErr } = await supabase.from("routes").delete()
      .neq("route_id", "00000000-0000-0000-0000-000000000000");
    if (delErr) throw new Error(`delete routes: ${delErr.message}`);
    // Insert en lotes de 500.
    for (let i = 0; i < routeRows.length; i += 500) {
      const { error: insErr } = await supabase.from("routes").insert(routeRows.slice(i, i + 500));
      if (insErr) throw new Error(`insert routes: ${insErr.message}`);
    }
  }
  console.log(`✓ Rutas: ${routeRows.length} filas (user,fecha), ${totalVisits} visitas, ${skipped} filas saltadas. ${commit ? "ESCRITAS" : "dry-run"}.`);
}
