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

async function nombresDeClientes(sb: ReturnType<typeof createClient>) {
  const { data } = await sb.from("clients").select("name");
  return new Set((data ?? []).map((c: { name: string }) => c.name));
}

async function main() {
  // --- ADMIN: lo ve todo ---
  console.log("\nADMIN (raponte@ponce-benzo.com)");
  {
    const sb = await sesion("raponte@ponce-benzo.com");
    const cli = await nombresDeClientes(sb);
    check("ve los 19 clientes", cli.size === 19, `vio ${cli.size}`);

    const { count: sc } = await sb
      .from("stores")
      .select("store_id", { count: "exact", head: true })
      .eq("active", true);
    check("ve las 197 tiendas activas", sc === 197, `vio ${sc}`);

    const { count: cc } = await sb
      .from("contacts")
      .select("contact_id", { count: "exact", head: true });
    check("ve los 234 contactos", cc === 234, `vio ${cc}`);

    const { count } = await sb.from("visits").select("visit_id", { count: "exact", head: true });
    check("ve todas las visitas (>= 654)", (count ?? 0) >= 654, `vio ${count}`);
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

    // Tiendas: solo las de sus clientes, y exactamente 10 activas.
    const { data: st } = await sb.from("stores").select("store_id, active, clients(name)");
    const ajenas = (st ?? []).filter(
      (s: { clients: { name: string } | null }) => !cli.has(s.clients?.name ?? ""),
    );
    check("no ve tiendas de clientes ajenos", ajenas.length === 0, `${ajenas.length} tiendas ajenas`);
    const activas = (st ?? []).filter((s: { active: boolean }) => s.active);
    check("ve exactamente 10 tiendas activas", activas.length === 10, `vio ${activas.length}`);

    // Contactos: exactamente los de su cartera.
    const { count: cc } = await sb.from("contacts").select("contact_id", { count: "exact", head: true });
    check("ve exactamente 10 contactos (los suyos)", cc === 10, `vio ${cc}`);

    // Visitas: solo las suyas, > 0.
    const { count: vc } = await sb.from("visits").select("visit_id", { count: "exact", head: true });
    check("ve al menos sus 29 visitas", (vc ?? 0) >= 29, `vio ${vc}`);

    // Mapa: excepcion deliberada, si ve las rutas completas.
    const { count: rc } = await sb.from("routes").select("route_id", { count: "exact", head: true });
    check("SI ve las rutas (excepcion del Mapa)", (rc ?? 0) > 0, "no ve ninguna");
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

    const { data: st } = await sb.from("stores").select("store_id, active, clients(name)");
    const ajenas = (st ?? []).filter(
      (s: { clients: { name: string } | null }) => !cli.has(s.clients?.name ?? ""),
    );
    check("no ve tiendas de clientes ajenos", ajenas.length === 0, `${ajenas.length} tiendas ajenas`);
    const activas = (st ?? []).filter((s: { active: boolean }) => s.active);
    check("ve exactamente 6 tiendas activas", activas.length === 6, `vio ${activas.length}`);

    const { count: cc } = await sb.from("contacts").select("contact_id", { count: "exact", head: true });
    check("ve exactamente 6 contactos (los suyos)", cc === 6, `vio ${cc}`);

    const { count: vc } = await sb.from("visits").select("visit_id", { count: "exact", head: true });
    check("ve al menos sus 16 visitas", (vc ?? 0) >= 16, `vio ${vc}`);
    await sb.auth.signOut();
  }

  // --- MERCADERISTA: solo lo suyo de campo + sus cuentas asignadas ---
  console.log("\nMERCADERISTA (czurita@ponce-benzo.com)");
  {
    const sb = await sesion("czurita@ponce-benzo.com");
    const { data: me } = await sb.auth.getUser();
    const yo = me.user!.id;
    const mios = await nombresDeClientes(sb); // sus clientes asignados
    check("ve sus 19 clientes asignados", mios.size === 19, `vio ${mios.size}`);
    check("ve LOCATEL (es su cuenta)", mios.has("LOCATEL"), `${[...mios]}`);

    // Toda visita visible debe ser suya, o de una tienda de un cliente suyo.
    const { data: v } = await sb
      .from("visits")
      .select("visit_id, user_id, stores(clients(name))");
    type VJ = { visit_id: string; user_id: string; stores: { clients: { name: string } | null } | null };
    const fugas = ((v ?? []) as unknown as VJ[]).filter(
      (x) => x.user_id !== yo && !mios.has(x.stores?.clients?.name ?? ""),
    );
    check("no ve visitas ajenas fuera de sus clientes", fugas.length === 0,
      `¡FUGA! ${fugas.length} visitas, p.ej. ${fugas[0]?.visit_id}`);

    // Y debe ver al menos una visita propia: si viera cero, la prueba anterior
    // pasaria trivialmente y estariamos midiendo nada.
    const propias = ((v ?? []) as unknown as VJ[]).filter((x) => x.user_id === yo);
    check("ve sus propias visitas", propias.length > 0, "vio 0 — la prueba anterior no vale");
    check("ve al menos sus 248 visitas en total", (v ?? []).length >= 248, `vio ${(v ?? []).length}`);

    // Catalogo completo de tiendas: la app movil cacheia todo para trabajar
    // sin senal. Si este numero baja, la APK se rompe en campo.
    const { count: sc } = await sb.from("stores").select("store_id", { count: "exact", head: true });
    check("conserva el catalogo completo (197 tiendas, sync offline)", (sc ?? 0) >= 197, `vio ${sc}`);

    const { count: cc } = await sb.from("contacts").select("contact_id", { count: "exact", head: true });
    check("ve los 234 contactos de sus cuentas", cc === 234, `vio ${cc}`);
    await sb.auth.signOut();
  }

  console.log(fallos === 0 ? "\n✓ RLS verificada, 0 fallos." : `\n✗ ${fallos} fallo(s).`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
