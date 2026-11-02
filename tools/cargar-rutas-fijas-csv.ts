// tools/cargar-rutas-fijas-csv.ts
//
// Carga un CSV "rutas_tracker" como RUTA FIJA (route_plans + route_plan_stops),
// una versión por mercaderista desde --desde, y la materializa en `routes`.
// Reemplaza al cargador viejo (filas sueltas por fecha), que ya no se usa.
// Por defecto es DRY-RUN; --commit escribe en producción.
//
//   npx --prefix hub tsx tools/cargar-rutas-fijas-csv.ts <csv> --desde 2026-11-09 [--commit]
//
// Tiendas: datos/pdv-tiendas.json guarda ID_PDV -> store_id y crece con cada carga.
// Un PDV que no está ahí tiene que estar en NUEVAS (se crea) o en PENDIENTES (no
// se carga); si no, el script se detiene para revisarlo a mano.
// Mercaderistas en SIN_RUTA reciben una versión vacía (quedan sin ruta desde --desde).
import * as fs from "fs";
import * as path from "path";
import { makeServiceClient } from "./ingesta/supabase";
import { planDesdeFilas, FilaCsv } from "./rutas-csv-a-plan";

const MAPA = path.join(__dirname, "../datos/pdv-tiendas.json");
const EMAIL: Record<string, string> = {
  M01: "erondon@ponce-benzo.com", M02: "wfermin@ponce-benzo.com", M03: "emartinez@ponce-benzo.com",
  M04: "czurita@ponce-benzo.com", M05: "carlosalfonsofaria@gmail.com", M06: "eugeniointel@gmail.com",
  M07: "danielperazavillegas@gmail.com",
};

// ---- Revisado a mano por carga (2026-11-02) ----
// PDV -> [nombre en la base, cliente en la base]. Se crea la tienda con GPS y zona del CSV.
const NUEVAS: Record<string, [string, string]> = {
  "PDV-0585": ["LOCATEL BOULEVARD DE CATIA", "LOCATEL"],
  "PDV-0337": ["FTD ESTACION SUR CHARALLAVE", "FARMATODO,C.A."],
  "PDV-0338": ["FTD OFELIA", "FARMATODO,C.A."],
  "PDV-0342": ["FTD ESMERALDA", "FARMATODO,C.A."],
  "PDV-0327": ["FTD DANILA", "FARMATODO,C.A."],
  "PDV-0584": ["EMPORIUM LOS CORTIJOS", "EMPORIUM"],
  "PDV-0581": ["VIVERES DE CANDIDO LA LAGO", "VIVERES DE CANDIDO"],
  "PDV-0583": ["FARMAYA LA LAGO", "FARMAYA"],
};
const PENDIENTES = new Set(["PDV-0194"]); // "Excelsior Gama" sin sucursal (Carlos Zurita)
const SIN_RUTA = new Set(["M03"]);        // Eduward, de vacaciones
// -------------------------------------------------

const CHANNEL: Record<string, string> = { Farmacia: "farmacia", Supermercado: "supermercado" };
const REGION: Record<string, { region: string; estado: string | null; ciudad: string | null }> = {
  "Gran Caracas": { region: "Region Capital", estado: null, ciudad: "Caracas" },
  "Zulia": { region: "Zulia", estado: "Zulia", ciudad: "Maracaibo" },
  "Anzoátegui": { region: "Anzoátegui", estado: "Anzoátegui", ciudad: null },
};
const DAY: Record<string, number> = { Lunes: 1, Martes: 2, "Miércoles": 3, Jueves: 4, Viernes: 5 };
const zona = (z: string) => {
  if (/por validar/i.test(z) || !z.includes("·")) return { municipio: null, urbanizacion: null };
  const [m, u] = z.split("·").map((s) => s.trim());
  return { municipio: m || null, urbanizacion: u || null };
};
const readCsv = (f: string) => {
  const l = fs.readFileSync(f, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const h = l[0].split(";");
  return l.slice(1).map((x) => { const c = x.split(";"); return Object.fromEntries(h.map((k, i) => [k, (c[i] ?? "").trim()])); });
};
const must = <T>(r: { data: T | null; error: { message: string } | null }, what: string): T => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data as T;
};

async function main() {
  const args = process.argv.slice(2);
  const csv = args.find((a) => !a.startsWith("--"));
  const desde = args[args.indexOf("--desde") + 1];
  const commit = args.includes("--commit");
  if (!csv || !/^\d{4}-\d{2}-\d{2}$/.test(desde ?? "")) throw new Error("Uso: <csv> --desde YYYY-MM-DD [--commit]");
  console.log(`=== Ruta fija desde ${desde} — ${commit ? "COMMIT (escribe en producción)" : "DRY-RUN"} ===`);

  const rows = readCsv(csv);
  const mapa: Record<string, string> = JSON.parse(fs.readFileSync(MAPA, "utf8"));
  const sb = makeServiceClient();

  const sinResolver = [...new Set(rows.map((r) => r.ID_PDV))].filter((p) => !mapa[p] && !NUEVAS[p] && !PENDIENTES.has(p));
  if (sinResolver.length) throw new Error(`PDV sin tienda (agrégalos a NUEVAS o PENDIENTES): ${sinResolver.map((p) => `${p} "${rows.find((r) => r.ID_PDV === p)!.Tienda}"`).join(", ")}`);
  const nuevas = Object.keys(NUEVAS).filter((p) => !mapa[p] && rows.some((r) => r.ID_PDV === p));

  const users = must(await sb.from("users").select("id,email,full_name").in("email", Object.values(EMAIL)), "users") as { id: string; email: string; full_name: string }[];
  const userOf = (m: string) => users.find((u) => u.email === EMAIL[m]) ?? (() => { throw new Error(`Sin usuario para ${m}`); })();
  const mercs = [...new Set([...rows.map((r) => r.ID_MERC), ...SIN_RUTA])].sort();
  const existentes = must(await sb.from("route_plans").select("user_id").eq("effective_from", desde), "route_plans") as { user_id: string }[];
  const yaHay = mercs.filter((m) => existentes.some((e) => e.user_id === userOf(m).id));
  if (yaHay.length) throw new Error(`Ya hay versión desde ${desde} para ${yaHay.join(", ")}: edítala en el hub o elige otra fecha`);

  const ids = [...new Set(Object.values(mapa))];
  const stores = must(await sb.from("stores").select("store_id,name,active").in("store_id", ids), "stores") as { store_id: string; name: string; active: boolean }[];
  const nombre = new Map(stores.map((s) => [s.store_id, s.name]));
  const inactivas = [...new Set(rows.filter((r) => mapa[r.ID_PDV]).map((r) => mapa[r.ID_PDV]))].filter((id) => stores.find((s) => s.store_id === id)?.active === false);

  console.log(`Tiendas nuevas (${nuevas.length}): ${nuevas.map((p) => NUEVAS[p][0]).join(", ") || "-"}`);
  console.log(`Inactivas a reactivar (${inactivas.length}): ${inactivas.map((id) => nombre.get(id)).join(", ") || "-"}`);
  console.log(`Pendientes, no se cargan: ${[...PENDIENTES].join(", ") || "-"}`);

  if (commit) {
    const clients = must(await sb.from("clients").select("client_id,name"), "clients") as { client_id: string; name: string }[];
    for (const p of nuevas) {
      const r = rows.find((x) => x.ID_PDV === p)!;
      const [name, client] = NUEVAS[p];
      const client_id = clients.find((c) => c.name === client)?.client_id;
      if (!client_id) throw new Error(`Cliente ${client} no existe`);
      const reg = REGION[r.Region] ?? (() => { throw new Error(`Región ${r.Region}`); })();
      const s = must(await sb.from("stores").insert({
        name, client_id, business_channel: CHANNEL[r.Tipo_PDV] ?? "otro",
        master_lat: r.Latitud ? Number(r.Latitud) : null, master_lng: r.Longitud ? Number(r.Longitud) : null,
        region: reg.region, estado: reg.estado, ciudad: reg.ciudad, ...zona(r.Zona), active: true,
      }).select("store_id").single(), `insert ${name}`) as { store_id: string };
      mapa[p] = s.store_id;
      nombre.set(s.store_id, name);
      fs.writeFileSync(MAPA, JSON.stringify(Object.fromEntries(Object.entries(mapa).sort()), null, 0).replace(/,"/g, ',\n"'));
    }
    if (inactivas.length) must(await sb.from("stores").update({ active: true }).in("store_id", inactivas), "reactivar");
  }

  const hoy = new Date();
  const hasta = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() + 56)).toISOString().slice(0, 10);
  for (const m of mercs) {
    const u = userOf(m);
    const filas: FilaCsv[] = SIN_RUTA.has(m) ? [] : rows
      .filter((r) => r.ID_MERC === m && !PENDIENTES.has(r.ID_PDV))
      .map((r) => ({ pdv: r.ID_PDV, store_id: mapa[r.ID_PDV] ?? `nueva:${r.ID_PDV}`, semana: Number(r.Semana.replace(/\D/g, "")), dia: DAY[r.Dia], orden: Number(r.Orden) }));
    const paradas = planDesdeFilas(filas, desde);
    const resumen = [1, 2, 3, 4, 5].map((d) => {
      const ps = paradas.filter((p) => p.weekday === d);
      return `${["", "Lu", "Ma", "Mi", "Ju", "Vi"][d]} ${ps.length} (${ps.filter((p) => p.every_n_weeks === 1).length} sem, ${ps.filter((p) => p.every_n_weeks === 2).length} c/2, ${ps.filter((p) => p.every_n_weeks === 4).length} c/4)`;
    }).join(" · ");
    console.log(`${m} ${u.full_name}: ${paradas.length} paradas — ${resumen}`);
    if (!commit) continue;

    const plan = must(await sb.from("route_plans").insert({ user_id: u.id, effective_from: desde }).select("plan_id").single(), `plan ${m}`) as { plan_id: string };
    if (paradas.length) {
      const { error } = await sb.from("route_plan_stops").insert(paradas.map(({ pdv, ...p }) => ({ ...p, plan_id: plan.plan_id })));
      if (error) { await sb.from("route_plans").delete().eq("plan_id", plan.plan_id); throw new Error(`stops ${m}: ${error.message}`); }
    }
    const n = must(await sb.rpc("fn_materializar_rutas", { p_user_id: u.id, p_desde: desde, p_hasta: hasta }), `materializar ${m}`);
    console.log(`  ✓ guardada; ${n} filas de routes escritas hasta ${hasta}`);
  }
  console.log(commit ? "=== Listo ===" : "=== Dry-run completado (usa --commit para escribir) ===");
}
main().catch((e) => { console.error("✖", e.message); process.exit(1); });
