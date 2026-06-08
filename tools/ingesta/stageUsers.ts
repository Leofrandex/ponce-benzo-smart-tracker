// tools/ingesta/stageUsers.ts
import * as path from "path";
import * as fs from "fs";
import { SupabaseClient } from "@supabase/supabase-js";

interface VendedorDef {
  full_name: string;
  email: string;
  role: "merchandiser" | "supervisor" | "admin";
  supervisor_email: string | null;
  excel_aliases: string[];
}

// Devuelve mapa email -> auth user id (creando los que falten). Idempotente.
export async function stageUsers(supabase: SupabaseClient): Promise<Map<string, string>> {
  const vendedores: VendedorDef[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../vendedores.json"), "utf8"),
  ).users;
  const passwords: Record<string, string> = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../vendedores.secret.json"), "utf8"),
  );

  // 1. Mapa de auth users existentes (email -> id), paginando.
  const authByEmail = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    for (const u of data.users) if (u.email) authByEmail.set(u.email.toLowerCase(), u.id);
    if (data.users.length < 1000) break;
  }

  // 2. Crear los auth users que falten (con contraseña temporal y email confirmado).
  for (const v of vendedores) {
    const key = v.email.toLowerCase();
    if (authByEmail.has(key)) continue;
    const pw = passwords[v.email];
    if (!pw) throw new Error(`Falta contraseña para ${v.email} en vendedores.secret.json`);
    const { data, error } = await supabase.auth.admin.createUser({
      email: v.email, password: pw, email_confirm: true,
    });
    if (error) throw new Error(`createUser ${v.email}: ${error.message}`);
    authByEmail.set(key, data.user!.id);
    console.log(`  + auth user creado: ${v.email}`);
  }

  // 3. Upsert en public.users en orden jerárquico (admin -> supervisor -> merchandiser),
  //    resolviendo supervisor_id por email.
  const order = { admin: 0, supervisor: 1, merchandiser: 2 } as const;
  const sorted = [...vendedores].sort((a, b) => order[a.role] - order[b.role]);
  for (const v of sorted) {
    const id = authByEmail.get(v.email.toLowerCase())!;
    const supervisor_id = v.supervisor_email
      ? authByEmail.get(v.supervisor_email.toLowerCase()) ?? null
      : null;
    const { error } = await supabase.from("users").upsert(
      { id, full_name: v.full_name, email: v.email, role: v.role, supervisor_id, active: true },
      { onConflict: "id" },
    );
    if (error) throw new Error(`upsert users ${v.email}: ${error.message}`);
  }

  console.log(`✓ Usuarios: ${vendedores.length} (Auth + tabla users) listos.`);
  return authByEmail;
}
