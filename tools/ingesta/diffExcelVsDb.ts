// tools/ingesta/diffExcelVsDb.ts
//
// Compara un Excel de coordenadas contra lo que YA está montado en Supabase,
// SIN escribir nada. Reutiliza el mismo parser y la misma lógica de
// emparejamiento que la ingesta real (`stageStoresMulti`), para que lo que se
// reporta aquí sea exactamente lo que pasaría al correr la carga.
//
// Uso:
//   npx tsx tools/ingesta/diffExcelVsDb.ts "<nuevo.xlsx>" ["<anterior.xlsx>"]
//
// El segundo argumento es opcional: si se pasa, además se reporta qué cambió
// respecto del Excel entregado la vez anterior (intención del cliente).
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { parseTiendas, isComplete, resolveStoreNames, markCoordCollisions, type TiendaRow } from "./parseTiendas";
import { assignExistingStores, type ExistingStore } from "./stageStoresMulti";
import { prefixForClient, channelForCanal, normClient } from "./tiendasConfig";

const DAY_NAMES = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"];
const MERCH_EMAIL: Record<string, string> = {
  "WILLIAN FERMAN": "wfermin@ponce-benzo.com",
  "CARLOS ZURITA": "czurita@ponce-benzo.com",
  "ELVIS RONDON": "erondon@ponce-benzo.com",
  "EDUWARD MARTINEZ": "emartinez@ponce-benzo.com",
  "JONATHAN FERNANDEZ": "jfernandez@ponce-benzo.com",
};

const norm = (s: string | null | undefined): string =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

const h1 = (t: string) => console.log(`\n${"=".repeat(72)}\n${t}\n${"=".repeat(72)}`);
const h2 = (t: string) => console.log(`\n--- ${t} ---`);

async function main() {
  const [nuevoPath, anteriorPath] = process.argv.slice(2);
  if (!nuevoPath) { console.error("Uso: diffExcelVsDb.ts <nuevo.xlsx> [anterior.xlsx]"); process.exit(1); }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env");
  const sb = createClient(url, key);

  // ── 1. Excel ───────────────────────────────────────────────────────────────
  const rows = parseTiendas(nuevoPath);
  const completas = rows.filter(isComplete);
  const incompletas = rows.filter((r) => !isComplete(r));

  h1(`EXCEL: ${nuevoPath.split(/[\\/]/).pop()}`);
  console.log(`Filas con nombre de tienda: ${rows.length}`);
  console.log(`  completas (entrarían a la ingesta): ${completas.length}`);
  console.log(`  incompletas (se quedarían fuera):   ${incompletas.length}`);

  if (incompletas.length) {
    const porFalta = new Map<string, number>();
    for (const r of incompletas) for (const f of r.faltantes) porFalta.set(f, (porFalta.get(f) ?? 0) + 1);
    console.log(`  motivos: ${[...porFalta].map(([f, n]) => `${f}=${n}`).join(", ")}`);
  }

  const sinPrefijo = completas.filter((r) => prefixForClient(r.cliente) == null);
  if (sinPrefijo.length) {
    h2("⚠ Clientes sin prefijo mapeado (la ingesta REAL abortaría aquí)");
    for (const c of new Set(sinPrefijo.map((r) => r.cliente))) console.log(`  "${c}"`);
  }
  const usables = completas.filter((r) => prefixForClient(r.cliente) != null);

  const colisiones = markCoordCollisions(usables);
  if (colisiones.length) {
    h2(`Coordenadas compartidas (legítimo: mismo centro comercial) — ${colisiones.length}`);
    for (const c of colisiones) console.log(`  ${c}`);
  }

  // ── 2. Estado actual en Supabase ───────────────────────────────────────────
  const { data: clients, error: cErr } = await sb.from("clients").select("client_id, name");
  if (cErr) throw new Error(`select clients: ${cErr.message}`);
  const clientIdByNorm = new Map<string, string>();
  const clientNameById = new Map<string, string>();
  for (const c of clients ?? []) {
    clientIdByNorm.set(normClient(c.name), c.client_id);
    clientNameById.set(c.client_id, c.name);
  }

  const { data: stores, error: sErr } = await sb.from("stores")
    .select("store_id, name, client_id, master_lat, master_lng, address, municipio, ciudad, estado, region, business_channel, active");
  if (sErr) throw new Error(`select stores: ${sErr.message}`);
  const storeById = new Map((stores ?? []).map((s) => [s.store_id, s]));

  const cadenasNuevas = [...new Set(usables.map((r) => normClient(r.cliente)))]
    .filter((k) => !clientIdByNorm.has(k));

  h1("ESTADO ACTUAL EN SUPABASE");
  console.log(`Cadenas (clients): ${clients?.length ?? 0}`);
  console.log(`Sucursales: ${stores?.length ?? 0} (activas: ${(stores ?? []).filter((s) => s.active).length})`);
  if (cadenasNuevas.length) console.log(`Cadenas que el Excel crearía nuevas: ${cadenasNuevas.join(", ")}`);

  // ── 3. Emparejamiento (misma lógica que la ingesta) ────────────────────────
  const names = resolveStoreNames(usables.map((r) => ({
    prefix: prefixForClient(r.cliente)!, nombre: r.nombreTienda, municipio: r.municipio,
  })));

  const existingByCoord = new Map<string, ExistingStore[]>();
  for (const s of stores ?? []) {
    if (s.client_id == null || s.master_lat == null || s.master_lng == null) continue;
    const k = `${s.client_id}|${Number(s.master_lat).toFixed(5)},${Number(s.master_lng).toFixed(5)}`;
    if (!existingByCoord.has(k)) existingByCoord.set(k, []);
    existingByCoord.get(k)!.push({ store_id: s.store_id, name: s.name });
  }
  const matchRows = usables.map((r, i) => {
    const clientId = clientIdByNorm.get(normClient(r.cliente)) ?? null;
    return {
      key: clientId ? `${clientId}|${r.lat!.toFixed(5)},${r.lng!.toFixed(5)}` : `sin-cliente|${i}`,
      finalName: names[i],
    };
  });
  const assigned = assignExistingStores(matchRows, existingByCoord);

  // ── 4. Rutas actuales (día de visita y mercaderista vigentes) ──────────────
  const hoy = new Date().toISOString().slice(0, 10);
  const { data: routes, error: rErr } = await sb.from("routes")
    .select("user_id, route_date, store_ids").gte("route_date", hoy);
  if (rErr) throw new Error(`select routes: ${rErr.message}`);
  const { data: users, error: uErr } = await sb.from("users").select("id, email, full_name");
  if (uErr) throw new Error(`select users: ${uErr.message}`);
  const userById = new Map((users ?? []).map((u) => [u.id, u]));

  // store_id -> días de la semana y mercaderistas con los que está ruteada hoy.
  const dbDays = new Map<string, Set<number>>();
  const dbMerch = new Map<string, Set<string>>();
  for (const r of routes ?? []) {
    const dow = new Date(`${r.route_date}T00:00:00Z`).getUTCDay();
    for (const sid of (r.store_ids ?? []) as string[]) {
      if (!dbDays.has(sid)) dbDays.set(sid, new Set());
      dbDays.get(sid)!.add(dow);
      if (!dbMerch.has(sid)) dbMerch.set(sid, new Set());
      dbMerch.get(sid)!.add(r.user_id);
    }
  }

  // ── 5. Diff campo a campo ──────────────────────────────────────────────────
  const nuevas: string[] = [];
  const reactivadas: string[] = [];
  const cambios: { store: string; campo: string; antes: string; ahora: string }[] = [];
  const matchedIds = new Set<string>();

  for (let i = 0; i < usables.length; i++) {
    const r = usables[i];
    const finalName = names[i];
    const sid = assigned.get(i);

    if (!sid) { nuevas.push(`${finalName}  [${r.municipio ?? "—"}, ${r.estado ?? "—"}]  ${r.lat},${r.lng}`); continue; }
    matchedIds.add(sid);
    const s = storeById.get(sid)!;
    if (!s.active) reactivadas.push(`${s.name} → ${finalName}`);

    const push = (campo: string, antes: unknown, ahora: unknown) => {
      const a = norm(String(antes ?? "")), b = norm(String(ahora ?? ""));
      if (a !== b) cambios.push({ store: s.name, campo, antes: String(antes ?? "—"), ahora: String(ahora ?? "—") });
    };

    push("nombre", s.name, finalName);
    push("direccion", s.address, r.direccion);
    push("municipio", s.municipio, r.municipio);
    push("ciudad", s.ciudad, r.ciudad);
    push("estado", s.estado, r.estado);
    push("region", s.region, r.region);
    push("canal", s.business_channel, channelForCanal(r.canal));

    const clientId = clientIdByNorm.get(normClient(r.cliente)) ?? null;
    if (clientId && s.client_id !== clientId) {
      push("cliente", clientNameById.get(s.client_id ?? "") ?? s.client_id, clientNameById.get(clientId) ?? clientId);
    }

    // Coordenada: sólo se reporta si mueve la ubicación de forma apreciable.
    const dLat = Math.abs(Number(s.master_lat) - r.lat!), dLng = Math.abs(Number(s.master_lng) - r.lng!);
    if (dLat > 1e-5 || dLng > 1e-5) {
      const metros = Math.round(Math.hypot(dLat * 111_320, dLng * 111_320 * Math.cos((r.lat! * Math.PI) / 180)));
      cambios.push({
        store: s.name, campo: `coordenada (~${metros} m)`,
        antes: `${s.master_lat}, ${s.master_lng}`, ahora: `${r.lat}, ${r.lng}`,
      });
    }

    // Día de visita vigente (derivado de las rutas futuras) vs el del Excel.
    const diasDb = [...(dbDays.get(sid) ?? [])].sort();
    const diasXls = [...r.weekdays].sort();
    if (diasDb.length && diasDb.join(",") !== diasXls.join(",")) {
      cambios.push({
        store: s.name, campo: "dia de visita",
        antes: diasDb.map((d) => DAY_NAMES[d]).join("-") || "—",
        ahora: diasXls.map((d) => DAY_NAMES[d]).join("-") || "—",
      });
    }

    // Mercaderista vigente vs el del Excel.
    const emailXls = MERCH_EMAIL[r.merch];
    const merchDb = [...(dbMerch.get(sid) ?? [])].map((id) => userById.get(id)?.email ?? id).sort();
    if (emailXls && merchDb.length && !merchDb.includes(emailXls.toLowerCase())) {
      cambios.push({
        store: s.name, campo: "mercaderista",
        antes: merchDb.map((e) => e.split("@")[0]).join(", "),
        ahora: emailXls.split("@")[0],
      });
    }
    if (!emailXls) cambios.push({ store: s.name, campo: "⚠ mercaderista sin mapear", antes: "—", ahora: r.merch });
  }

  const sobranEnDb = (stores ?? []).filter((s) => s.active && !matchedIds.has(s.store_id));

  // ── 6. Reporte ─────────────────────────────────────────────────────────────
  h1("DIFERENCIAS EXCEL vs SUPABASE");
  console.log(`Sucursales del Excel que YA existen y se actualizarían: ${matchedIds.size}`);
  console.log(`Sucursales que se CREARÍAN nuevas:                      ${nuevas.length}`);
  console.log(`Sucursales inactivas que se REACTIVARÍAN:               ${reactivadas.length}`);
  console.log(`Sucursales ACTIVAS en la DB que el Excel no menciona:   ${sobranEnDb.length}`);
  console.log(`Campos con cambio de valor:                             ${cambios.length}`);

  if (nuevas.length) { h2(`NUEVAS (${nuevas.length})`); for (const n of nuevas) console.log(`  + ${n}`); }
  if (reactivadas.length) { h2(`REACTIVACIONES (${reactivadas.length})`); for (const n of reactivadas) console.log(`  ~ ${n}`); }

  if (sobranEnDb.length) {
    h2(`ACTIVAS EN DB SIN FILA EN EL EXCEL (${sobranEnDb.length}) — quedarían como están, NO se desactivan`);
    for (const s of sobranEnDb) console.log(`  ? ${s.name}  [${s.municipio ?? "—"}]`);
  }

  if (cambios.length) {
    const porCampo = new Map<string, typeof cambios>();
    for (const c of cambios) {
      if (!porCampo.has(c.campo)) porCampo.set(c.campo, []);
      porCampo.get(c.campo)!.push(c);
    }
    // Las coordenadas se agrupan aparte (cada una tiene su distancia en el nombre).
    const coordCambios = cambios.filter((c) => c.campo.startsWith("coordenada"));
    for (const [campo, list] of porCampo) {
      if (campo.startsWith("coordenada")) continue;
      h2(`CAMBIO DE ${campo.toUpperCase()} (${list.length})`);
      for (const c of list) console.log(`  ${c.store}\n      antes: ${c.antes}\n      ahora: ${c.ahora}`);
    }
    if (coordCambios.length) {
      h2(`CAMBIO DE COORDENADA (${coordCambios.length})`);
      for (const c of coordCambios) console.log(`  ${c.store} — ${c.campo.replace("coordenada ", "")}\n      antes: ${c.antes}\n      ahora: ${c.ahora}`);
    }
  }

  if (incompletas.length) {
    h2(`FILAS INCOMPLETAS DEL EXCEL (${incompletas.length}) — no entrarían`);
    for (const r of incompletas) {
      console.log(`  fila ${r.rowIndex + 1}: ${r.cliente} ${r.nombreTienda} — falta: ${r.faltantes.join(", ")}`);
    }
  }

  // ── 7. Excel nuevo vs Excel anterior (opcional) ────────────────────────────
  if (anteriorPath) {
    const prev = parseTiendas(anteriorPath).filter(isComplete).filter((r) => prefixForClient(r.cliente) != null);
    const keyOf = (r: TiendaRow) => `${normClient(r.cliente)}|${r.nombreTienda}`;
    const prevByKey = new Map(prev.map((r) => [keyOf(r), r]));
    const currByKey = new Map(usables.map((r) => [keyOf(r), r]));

    h1(`EXCEL NUEVO vs EXCEL ANTERIOR (${anteriorPath.split(/[\\/]/).pop()})`);
    console.log(`Anterior: ${prev.length} filas completas · Nuevo: ${usables.length}`);

    const agregadas = [...currByKey.keys()].filter((k) => !prevByKey.has(k));
    const quitadas = [...prevByKey.keys()].filter((k) => !currByKey.has(k));
    if (agregadas.length) { h2(`AGREGADAS respecto del anterior (${agregadas.length})`); for (const k of agregadas) console.log(`  + ${k}`); }
    if (quitadas.length) { h2(`YA NO ESTÁN respecto del anterior (${quitadas.length})`); for (const k of quitadas) console.log(`  - ${k}`); }

    const editadas: string[] = [];
    for (const [k, cur] of currByKey) {
      const p = prevByKey.get(k);
      if (!p) continue;
      const diffs: string[] = [];
      if (p.lat !== cur.lat || p.lng !== cur.lng) diffs.push(`coord ${p.lat},${p.lng} → ${cur.lat},${cur.lng}`);
      if (p.weekdays.join() !== cur.weekdays.join()) {
        diffs.push(`dia ${p.weekdays.map((d) => DAY_NAMES[d]).join("-")} → ${cur.weekdays.map((d) => DAY_NAMES[d]).join("-")}`);
      }
      if (p.weeks.join() !== cur.weeks.join()) diffs.push(`semana ${p.weeks.join("-")} → ${cur.weeks.join("-")}`);
      if (norm(p.merch) !== norm(cur.merch)) diffs.push(`merch ${p.merch} → ${cur.merch}`);
      if (norm(p.direccion) !== norm(cur.direccion)) diffs.push("direccion");
      if (norm(p.encargado) !== norm(cur.encargado)) diffs.push(`encargado ${p.encargado ?? "—"} → ${cur.encargado ?? "—"}`);
      if (diffs.length) editadas.push(`  ~ ${k}\n      ${diffs.join("\n      ")}`);
    }
    if (editadas.length) { h2(`EDITADAS (${editadas.length})`); for (const e of editadas) console.log(e); }
  }

  h1("FIN — no se escribió NADA en Supabase");
}

main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
