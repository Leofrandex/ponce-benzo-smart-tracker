// Siembra public.client_assignments desde el Excel de asesores del cliente.
// Idempotente: borra las asignaciones previas y reescribe.
import * as path from "path";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import { construirAsignaciones, type FilaExcel } from "./asignaciones";

const XLS = path.join(
  __dirname, "../../ponce-benzo-vault/inbox/procesados",
  "2026-08-12 Lista de asesores gerente y clientes.xlsx",
);

async function main() {
  const commit = process.argv.includes("--commit");
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const hoja = XLSX.readFile(XLS).Sheets["Hoja1"];
  const crudas = XLSX.utils.sheet_to_json<Record<string, string>>(hoja, { defval: "" });
  const filas: FilaExcel[] = crudas.map((r) => ({
    nombreCorto: r["Nombre corto"],
    asesor:      r["ASESOR COMERCIAL"],
    gerente:     r["GERENTE DE DISTRITO"],
    mailAsesor:  r["Mail del Asesor"],
    mailGerente: r["Mail del Gerente"],
  }));

  const personas = construirAsignaciones(filas);

  const { data: users } = await sb.from("users").select("id, email");
  const idPorEmail = new Map((users ?? []).map((u) => [u.email.toLowerCase(), u.id]));
  const { data: clients } = await sb.from("clients").select("client_id, name");
  const idPorCliente = new Map((clients ?? []).map((c) => [c.name, c.client_id]));

  const filasDb: { user_id: string; client_id: string }[] = [];
  for (const p of personas) {
    const uid = idPorEmail.get(p.email);
    if (!uid) { console.warn(`  ! sin usuario para ${p.nombre} <${p.email || "sin correo"}>`); continue; }
    for (const cli of p.clientes) {
      const cid = idPorCliente.get(cli);
      if (!cid) { console.warn(`  ! cliente inexistente: ${cli}`); continue; }
      filasDb.push({ user_id: uid, client_id: cid });
    }
  }

  console.log(`Personas: ${personas.length} · Asignaciones a escribir: ${filasDb.length}`);
  for (const p of personas) console.log(`  ${p.nombre.padEnd(22)} ${p.clientes.length} clientes`);

  // Clientes activos que quedarían sin nadie: hay que verlos antes de activar RLS.
  const asignados = new Set(filasDb.map((f) => f.client_id));
  const huerfanos = (clients ?? []).filter((c) => !asignados.has(c.client_id)).map((c) => c.name);
  if (huerfanos.length) console.warn(`\n  ⚠ CLIENTES SIN VENDEDOR: ${huerfanos.join(", ")}`);

  if (!commit) { console.log("\n(dry-run — usar --commit para escribir)"); return; }

  await sb.from("client_assignments").delete().neq("user_id", "00000000-0000-0000-0000-000000000000");
  const { error } = await sb.from("client_assignments").insert(filasDb);
  if (error) throw new Error(`insert: ${error.message}`);
  console.log(`\n✓ ${filasDb.length} asignaciones escritas.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
