// Verifica RLS con sesion real de cada rol. Comprueba tanto lo que se ve
// como lo que NO se ve: lo segundo es lo que atrapa los errores reales.
import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const URL = process.env.SUPABASE_URL!;
const ANON = process.env.SUPABASE_ANON_KEY!;
const PW: Record<string, string> = JSON.parse(
  fs.readFileSync(path.join(__dirname, "vendedores.secret.json"), "utf8"),
);

const TAM_PAGINA = 1000;

let fallos = 0;
function check(nombre: string, ok: boolean, detalle: string = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${nombre}${ok ? "" : ` — ${detalle}`}`);
  if (!ok) fallos++;
}

async function sesion(email: string) {
  const sb = createClient(URL, ANON);
  const { error } = await sb.auth.signInWithPassword({ email, password: PW[email] });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return sb;
}

// PostgREST corta en 1000 filas por defecto: sin paginar, una comprobacion de
// fugas se volveria ciega en silencio en cuanto una tabla supere las mil filas.
// Este helper pagina con .range() hasta agotar resultados y lanza si algun
// tramo falla, en vez de tragarse el error como data ?? [].
async function paginado<T>(
  sb: ReturnType<typeof createClient>,
  tabla: string,
  select: string,
): Promise<T[]> {
  const todas: T[] = [];
  for (let desde = 0; ; desde += TAM_PAGINA) {
    const { data, error } = await sb.from(tabla).select(select).range(desde, desde + TAM_PAGINA - 1);
    if (error) throw new Error(`${tabla} (rango ${desde}): ${error.message}`);
    const lote = (data ?? []) as unknown as T[];
    todas.push(...lote);
    if (lote.length < TAM_PAGINA) break;
  }
  return todas;
}

async function contar(
  sb: ReturnType<typeof createClient>,
  tabla: string,
  filtro?: (q: any) => any,
): Promise<number> {
  let q: any = sb.from(tabla).select("*", { count: "exact", head: true });
  if (filtro) q = filtro(q);
  const { count, error } = await q;
  if (error) throw new Error(`count ${tabla}: ${error.message}`);
  return count ?? 0;
}

async function nombresDeClientes(sb: ReturnType<typeof createClient>) {
  const filas = await paginado<{ name: string }>(sb, "clients", "name");
  return new Set(filas.map((c) => c.name));
}

async function main() {
  // --- ADMIN: lo ve todo ---
  console.log("\nADMIN (raponte@ponce-benzo.com)");
  {
    const sb = await sesion("raponte@ponce-benzo.com");
    const cli = await nombresDeClientes(sb);
    check("ve los 19 clientes", cli.size === 19, `vio ${cli.size}`);

    const sc = await contar(sb, "stores", (q) => q.eq("active", true));
    check("ve las 197 tiendas activas", sc === 197, `vio ${sc}`);

    const cc = await contar(sb, "contacts");
    check("ve los 234 contactos", cc === 234, `vio ${cc}`);

    const vc = await contar(sb, "visits");
    check("ve todas las visitas (>= 654)", vc >= 654, `vio ${vc}`);
    await sb.auth.signOut();
  }

  // --- VENDEDORA con cartera acotada: Betsy Castro (PARAMO + CENTRAL MADEIRENSE) ---
  console.log("\nVENDEDORA (bcastro@ponce-benzo.com)");
  {
    const sb = await sesion("bcastro@ponce-benzo.com");
    const cli = await nombresDeClientes(sb);
    check("ve exactamente sus 2 clientes", cli.size === 2, `vio ${cli.size}: ${[...cli]}`);
    check("ve PARAMO", cli.has("PARAMO"), "no lo ve");
    check("ve CENTRAL MADEIRENSE", cli.has("CENTRAL MADEIRENSE"), "no lo ve");
    check("NO ve FARMATODO", !cli.has("FARMATODO,C.A."), "¡FUGA! ve Farmatodo");
    check("NO ve LOCATEL", !cli.has("LOCATEL"), "¡FUGA! ve Locatel");
    check("NO ve RED VITAL", !cli.has("RED VITAL"), "¡FUGA! ve Red Vital");

    // Tiendas: solo las de sus clientes, y exactamente 10 activas. Paginado
    // por prudencia (hoy ~197 filas, cifra estable, pero el patron es el mismo).
    type ST = { store_id: string; active: boolean; clients: { name: string } | null };
    const st = await paginado<ST>(sb, "stores", "store_id, active, clients(name)");
    const ajenas = st.filter((s) => !cli.has(s.clients?.name ?? ""));
    check("no ve tiendas de clientes ajenos", ajenas.length === 0, `${ajenas.length} tiendas ajenas`);
    const activas = st.filter((s) => s.active);
    check("ve exactamente 10 tiendas activas", activas.length === 10, `vio ${activas.length}`);

    // Contactos: exactamente los de su cartera.
    const cc = await contar(sb, "contacts");
    check("ve exactamente 10 contactos (los suyos)", cc === 10, `vio ${cc}`);

    // Visitas: solo las suyas, > 0.
    const vc = await contar(sb, "visits");
    check("ve al menos sus 29 visitas", vc >= 29, `vio ${vc}`);

    // Mapa: excepcion deliberada, si ve las rutas completas.
    const rc = await contar(sb, "routes");
    check("SI ve las rutas (excepcion del Mapa)", rc > 0, "no ve ninguna");
    await sb.auth.signOut();
  }

  // --- VENDEDOR con cartera de 1 cliente: Juan Leon (RED VITAL) ---
  console.log("\nVENDEDOR (jleon@ponce-benzo.com)");
  {
    const sb = await sesion("jleon@ponce-benzo.com");
    const cli = await nombresDeClientes(sb);
    check("ve exactamente 1 cliente (RED VITAL)", cli.size === 1 && cli.has("RED VITAL"), `vio ${cli.size}: ${[...cli]}`);
    check("NO ve PARAMO", !cli.has("PARAMO"), "¡FUGA! ve Paramo");
    check("NO ve FARMATODO", !cli.has("FARMATODO,C.A."), "¡FUGA! ve Farmatodo");
    check("NO ve LOCATEL", !cli.has("LOCATEL"), "¡FUGA! ve Locatel");

    type ST = { store_id: string; active: boolean; clients: { name: string } | null };
    const st = await paginado<ST>(sb, "stores", "store_id, active, clients(name)");
    const ajenas = st.filter((s) => !cli.has(s.clients?.name ?? ""));
    check("no ve tiendas de clientes ajenos", ajenas.length === 0, `${ajenas.length} tiendas ajenas`);
    const activas = st.filter((s) => s.active);
    check("ve exactamente 6 tiendas activas", activas.length === 6, `vio ${activas.length}`);

    const cc = await contar(sb, "contacts");
    check("ve exactamente 6 contactos (los suyos)", cc === 6, `vio ${cc}`);

    const vc = await contar(sb, "visits");
    check("ve al menos sus 16 visitas", vc >= 16, `vio ${vc}`);
    await sb.auth.signOut();
  }

  // --- MERCADERISTA: solo lo suyo de campo + sus cuentas asignadas ---
  console.log("\nMERCADERISTA (czurita@ponce-benzo.com)");
  {
    const sb = await sesion("czurita@ponce-benzo.com");
    const { data: me, error: errUser } = await sb.auth.getUser();
    if (errUser) throw new Error(`auth.getUser: ${errUser.message}`);
    const yo = me.user!.id;
    // Baseline real de fugas: sus asignaciones en client_assignments, NO
    // clients (esa tabla la ve completa por la rama fn_is_merchandiser(), asi
    // que usarla como "mios" hacia que la comprobacion de fugas fuera
    // tautologica — mios siempre contenia todo, "fugas" nunca podia ser != []).
    type CA = { client_id: string; clients: { name: string } | null };
    const asignaciones = await paginado<CA>(sb, "client_assignments", "client_id, clients(name)");
    const mios = new Set(asignaciones.map((a) => a.clients?.name).filter((n): n is string => !!n));
    check("ve LOCATEL (es su cuenta)", mios.has("LOCATEL"), `${[...mios]}`);

    // Aparte: el catalogo completo de clientes SI debe seguir visible (rama
    // fn_is_merchandiser() de clients_select) — la app movil lo necesita para
    // la cache offline, no es una fuga.
    const cli = await nombresDeClientes(sb);
    check("conserva el catalogo completo de clientes, necesario para la caché offline", cli.size === 19, `vio ${cli.size}`);

    // Toda visita visible debe ser suya, o de una tienda de un cliente suyo.
    // Paginado: hoy 248 visitas visibles para Carlos con 654 en el sistema,
    // pero sin paginar esta comprobacion se volveria ciega en silencio en
    // cuanto el total supere las mil filas — justo la asercion de fuga.
    type VJ = { visit_id: string; user_id: string; stores: { clients: { name: string } | null } | null };
    const todas = await paginado<VJ>(sb, "visits", "visit_id, user_id, stores(clients(name))");

    const fugas = todas.filter((x) => x.user_id !== yo && !mios.has(x.stores?.clients?.name ?? ""));
    check("no ve visitas ajenas fuera de sus clientes", fugas.length === 0,
      `¡FUGA! ${fugas.length} visitas, p.ej. ${fugas[0]?.visit_id}`);

    // Y debe ver al menos una visita propia: si viera cero, la prueba anterior
    // pasaria trivialmente y estariamos midiendo nada.
    const propias = todas.filter((x) => x.user_id === yo);
    check("ve sus propias visitas", propias.length > 0, "vio 0 — la prueba anterior no vale");
    check("ve al menos sus 248 visitas en total", todas.length >= 248, `vio ${todas.length}`);

    // Catalogo completo de tiendas: la app movil cacheia todo para trabajar
    // sin senal. Si este numero baja, la APK se rompe en campo.
    const sc = await contar(sb, "stores");
    check("conserva el catalogo completo (197 tiendas, sync offline)", sc >= 197, `vio ${sc}`);

    const cc = await contar(sb, "contacts");
    check("conserva los 234 contactos completos (misma rama fn_is_merchandiser())", cc === 234, `vio ${cc}`);
    await sb.auth.signOut();
  }

  console.log(fallos === 0 ? "\n✓ RLS verificada, 0 fallos." : `\n✗ ${fallos} fallo(s).`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
