/**
 * Pipeline de ingesta idempotente — Ponzivenzo Smart Tracker.
 *
 * Pobla Supabase con: 6 usuarios (Auth + users), 192 tiendas y 20 rutas
 * (4 asesores × 5 días de la semana de referencia). Re-ejecutable sin duplicar.
 *
 * Requisitos:
 *   - hub/.env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 *   - tools/vendedores.json (mapeo) y tools/vendedores.secret.json (contraseñas, gitignored).
 *   - RUTAS 05-12-25 (1).xlsx en la raíz del repo.
 *
 * Uso (desde la raíz, usando node_modules de hub vía junction en la raíz):
 *   cd hub && node --import tsx ../tools/import-data.ts
 */
import { makeServiceClient } from "./ingesta/supabase";
import { stageUsers } from "./ingesta/stageUsers";
import { stageStores } from "./ingesta/stageStores";
import { stageRoutes } from "./ingesta/stageRoutes";

async function main() {
  console.log("=== Ingesta Ponzivenzo — inicio ===");
  const supabase = makeServiceClient();

  const authByEmail = await stageUsers(supabase);
  const storeByKey = await stageStores(supabase);
  await stageRoutes(supabase, authByEmail, storeByKey);

  console.log("=== Ingesta completada ===");
}

main().catch((e) => { console.error("ERROR de ingesta:", e.message); process.exit(1); });
