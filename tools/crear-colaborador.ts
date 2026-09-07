// tools/crear-colaborador.ts
//
// Alta idempotente de la CUENTA MAESTRA COMPARTIDA `colaborador@ponce-benzo.com`:
// la usa la direccion para registrar recorridos desde la app movil, en lugar de
// que cada admin entre con su cuenta personal.
//
// Requisito previo: aplicar tools/migraciones/2026-08-31-colaborador-y-nota-de-cierre.sql
// (sin el, el CHECK de users.role rechaza el rol 'colaborador').
//
//   npx tsx tools/crear-colaborador.ts            # dry-run, no escribe
//   npx tsx tools/crear-colaborador.ts --commit   # crea/actualiza en produccion
import * as path from "path";
import * as fs from "fs";
import { makeServiceClient } from "./ingesta/supabase";

const EMAIL = "colaborador@ponce-benzo.com";
const FULL_NAME = "Colaborador P&B";

async function main() {
  const commit = process.argv.includes("--commit");
  console.log(`=== Cuenta maestra colaborador — ${commit ? "COMMIT" : "DRY-RUN"} ===`);

  const passwords: Record<string, string> = JSON.parse(
    fs.readFileSync(path.join(__dirname, "vendedores.secret.json"), "utf8"),
  );
  const password = passwords[EMAIL];
  if (!password) throw new Error(`Falta la contrasena de ${EMAIL} en tools/vendedores.secret.json`);

  const sb = makeServiceClient();

  // 1. Auth user (paginado, como en stageUsers).
  let authId: string | null = null;
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === EMAIL);
    if (hit) { authId = hit.id; break; }
    if (data.users.length < 1000) break;
  }

  if (authId) {
    console.log(`  = auth user ya existe: ${EMAIL} (${authId})`);
  } else if (!commit) {
    console.log(`  ~ crearia el auth user ${EMAIL}`);
  } else {
    const { data, error } = await sb.auth.admin.createUser({
      email: EMAIL, password, email_confirm: true,
    });
    if (error) throw new Error(`createUser ${EMAIL}: ${error.message}`);
    authId = data.user!.id;
    console.log(`  + auth user creado: ${EMAIL} (${authId})`);
  }

  // 2. Perfil en public.users. Sin supervisor_id: la cuenta no cuelga de nadie,
  //    y las tareas que genere quedan sin asignatario (se ven por tienda en el hub).
  if (!commit) { console.log("  ~ upsert en public.users omitido (dry-run)"); return; }
  const { error } = await sb.from("users").upsert(
    {
      id: authId,
      full_name: FULL_NAME,
      email: EMAIL,
      role: "colaborador",
      supervisor_id: null,
      active: true,
      is_supervisor: false,
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(`upsert users ${EMAIL}: ${error.message}`);
  console.log(`✓ Perfil listo: ${FULL_NAME} <${EMAIL}> rol=colaborador`);
}

main().catch((e) => { console.error(`✗ ${e.message}`); process.exit(1); });
