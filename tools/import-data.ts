// tools/import-data.ts
import * as path from "path";
import { makeServiceClient } from "./ingesta/supabase";
import { stageUsers } from "./ingesta/stageUsers";
import { parseTiendas, isComplete, markCoordCollisions } from "./ingesta/parseTiendas";
import { stageChains } from "./ingesta/stageChains";
import { stageStoresMulti } from "./ingesta/stageStoresMulti";
import { stageRoutesMulti } from "./ingesta/stageRoutesMulti";
import { exportIncompletas } from "./ingesta/exportIncompletas";
import { deactivateNonPilot } from "./ingesta/deactivateNonPilot";

const FUENTE = path.join(__dirname, "../datos/fuentes/tiendas.xlsx");
const REVISION = path.join(__dirname, "../datos/revision/tiendas-incompletas-2026-07-14.xlsx");

async function main() {
  const commit = process.argv.includes("--commit");
  console.log(`=== Ingesta multi-cadena — ${commit ? "COMMIT (escribe en producción)" : "DRY-RUN (sin escrituras)"} ===`);

  const rows = parseTiendas(FUENTE);
  // Sucursales distintas con la misma coordenada (mismo centro comercial) son
  // válidas — la llave incluye el nombre. Solo se reportan para visibilidad.
  const conflicts = markCoordCollisions(rows);
  if (conflicts.length) {
    console.log(`ℹ ${conflicts.length} coordenada(s) compartida(s) (mismo centro comercial — se ingieren todas):`);
    for (const c of conflicts) console.log(`   ${c}`);
  }
  const completas = rows.filter(isComplete);
  const incompletas = rows.filter((r) => !isComplete(r));
  console.log(`Filas: ${rows.length} | completas: ${completas.length} | incompletas: ${incompletas.length}`);

  // El Excel de revisión se genera SIEMPRE (no toca DB). Si el archivo está
  // bloqueado (abierto en Excel), no debe abortar la ingesta a la DB: se avisa.
  try {
    exportIncompletas(incompletas, FUENTE, REVISION);
  } catch (e) {
    console.warn(`⚠ No se pudo escribir el Excel de revisión (¿abierto en Excel?): ${(e as Error).message}. La ingesta continúa.`);
  }

  const supabase = makeServiceClient();
  if (commit) await stageUsers(supabase);

  const chainMap = await stageChains(supabase, completas, commit);
  const { pilot, idByKey } = await stageStoresMulti(supabase, completas, chainMap, commit);

  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const to = new Date(Date.UTC(2026, 11, 31));
  await stageRoutesMulti(supabase, completas, idByKey, from, to, commit);

  if (commit) await deactivateNonPilot(supabase, pilot);

  console.log(`=== ${commit ? "Ingesta completada" : "Dry-run completado (usa --commit para escribir)"} ===`);
}
main().catch((e) => { console.error("ERROR de ingesta:", e.message); process.exit(1); });
