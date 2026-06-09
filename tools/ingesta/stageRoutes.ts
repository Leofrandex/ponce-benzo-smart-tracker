// tools/ingesta/stageRoutes.ts
import * as path from "path";
import * as fs from "fs";
import { SupabaseClient } from "@supabase/supabase-js";
import { parseRutas } from "./parseRutas";
import { dateForRuta, storeKey } from "./helpers";

interface VendedorDef {
  email: string;
  excel_aliases: string[];
}

// Crea/actualiza las rutas reales de cada asesor (una por "Ruta N" del Excel),
// fechadas vía dateForRuta (Ruta 1-5 = esta semana, 6-10 = la siguiente). Idempotente.
export async function stageRoutes(
  supabase: SupabaseClient,
  authByEmail: Map<string, string>,
  storeByKey: Map<string, string>,
): Promise<void> {
  const vendedores: VendedorDef[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../vendedores.json"), "utf8"),
  ).users;

  // alias normalizado -> email
  const emailByAlias = new Map<string, string>();
  for (const v of vendedores)
    for (const a of v.excel_aliases) emailByAlias.set(a.toUpperCase().replace(/\s+/g, " ").trim(), v.email);

  const now = new Date();
  const advisors = parseRutas(path.join(__dirname, "../../RUTAS 05-12-25 (1).xlsx"));

  const routeRows: { user_id: string; route_date: string; store_ids: string[] }[] = [];
  for (const adv of advisors) {
    const aliasKey = adv.sheetName.toUpperCase().replace(/\s+/g, " ").trim();
    const email = emailByAlias.get(aliasKey);
    if (!email) { console.warn(`⚠ Hoja sin asesor mapeado: "${adv.sheetName}" — omitida.`); continue; }
    const userId = authByEmail.get(email.toLowerCase());
    if (!userId) { console.warn(`⚠ Sin auth id para ${email} — ruta omitida.`); continue; }

    for (const route of adv.routes) {
      const storeIds = route.stores
        .map((s) => storeByKey.get(storeKey(s)))
        .filter((id): id is string => Boolean(id));
      routeRows.push({ user_id: userId, route_date: dateForRuta(route.rutaNumber, now), store_ids: storeIds });
    }
  }

  const { error } = await supabase.from("routes").upsert(routeRows, { onConflict: "user_id,route_date" });
  if (error) throw new Error(`upsert routes: ${error.message}`);
  console.log(`✓ Rutas: ${routeRows.length}.`);
}
