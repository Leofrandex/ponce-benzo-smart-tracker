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

  // Plan por (user_id, fecha) -> Set<CLAVE de tienda>. Se agrupa por la clave
  // natural de la tienda (cliente+coord), NO por store_id, para que el conteo
  // del dry-run sea exacto aunque las tiendas nuevas todavía no tengan id.
  const plan = new Map<string, Set<string>>();
  let skipped = 0;
  for (const r of completas) {
    const email = MERCH_EMAIL[r.merch];
    if (!email) { console.warn(`⚠ Mercaderista sin mapear: "${r.merch}"`); skipped++; continue; }
    const userId = idByEmail.get(email.toLowerCase());
    if (!userId) { console.warn(`⚠ Sin user id para ${email}`); skipped++; continue; }
    const key = storeKeyFor(r);
    for (const date of generateRouteDates({ weekdays: r.weekdays, weeks: r.weeks }, from, to)) {
      const k = `${userId}|${date}`;
      if (!plan.has(k)) plan.set(k, new Set());
      plan.get(k)!.add(key);
    }
  }

  const totalVisits = [...plan.values()].reduce((s, set) => s + set.size, 0);
  console.log(`✓ Rutas: ${plan.size} filas (user,fecha), ${totalVisits} visitas, ${skipped} filas saltadas. ${commit ? "ESCRIBIENDO..." : "dry-run"}.`);
  if (!commit) return;

  // Resolver CLAVE de tienda -> store_id (ya creadas por stageStoresMulti).
  const routeRows: { user_id: string; route_date: string; store_ids: string[] }[] = [];
  let missing = 0;
  for (const [k, keys] of plan) {
    const [user_id, route_date] = k.split("|");
    const store_ids: string[] = [];
    for (const key of keys) {
      const id = idByKey.get(key);
      if (!id) { missing++; continue; }
      store_ids.push(id);
    }
    if (store_ids.length) routeRows.push({ user_id, route_date, store_ids });
  }
  if (missing) console.warn(`⚠ ${missing} referencias tienda→id sin resolver (se omiten).`);

  const fromISO = from.toISOString().slice(0, 10);

  // SEGURIDAD: nunca borrar todas las rutas. `sessions.route_id` es
  // ON DELETE CASCADE hacia sessions -> visits/location_pings, así que borrar
  // una ruta con historial destruiría check-ins, fotos y GPS. Se borran SOLO
  // rutas FUTURAS (route_date >= hoy) que NO tengan sesión asociada; el resto
  // (pasado + rutas ya trabajadas) se preserva intacto.
  const { data: sess, error: sErr } = await supabase.from("sessions").select("route_id");
  if (sErr) throw new Error(`select sessions: ${sErr.message}`);
  const withSession = new Set((sess ?? []).map((s: { route_id: string }) => s.route_id));

  const { data: future, error: fErr } = await supabase.from("routes")
    .select("route_id").gte("route_date", fromISO);
  if (fErr) throw new Error(`select routes futuras: ${fErr.message}`);
  const toDelete = (future ?? [])
    .map((r: { route_id: string }) => r.route_id)
    .filter((id: string) => !withSession.has(id));

  for (let i = 0; i < toDelete.length; i += 500) {
    const { error } = await supabase.from("routes").delete().in("route_id", toDelete.slice(i, i + 500));
    if (error) throw new Error(`delete routes futuras: ${error.message}`);
  }

  // Upsert por (user_id, route_date): actualiza store_ids de las rutas que
  // sobrevivieron (las que tenían sesión) e inserta las nuevas. Idempotente:
  // una re-corrida o un fallo parcial no destruye historial, solo hay que
  // volver a ejecutar.
  for (let i = 0; i < routeRows.length; i += 500) {
    const { error } = await supabase.from("routes")
      .upsert(routeRows.slice(i, i + 500), { onConflict: "user_id,route_date" });
    if (error) throw new Error(`upsert routes: ${error.message}`);
  }
  console.log(`✓ Rutas escritas: ${routeRows.length} filas; ${toDelete.length} rutas futuras sin sesión eliminadas; historial preservado.`);
}
