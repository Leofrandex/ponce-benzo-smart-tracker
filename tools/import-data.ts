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
  // Guard: sucursales distintas con la misma coordenada rompen la llave
  // cliente+coord → se degradan a incompletas (coord_duplicada) y van a revisión.
  const conflicts = markCoordCollisions(rows);
  if (conflicts.length) {
    console.warn(`⚠ ${conflicts.length} colisión(es) de coordenada (van a revisión, NO se ingieren):`);
    for (const c of conflicts) console.warn(`   ${c}`);
  }
  const completas = rows.filter(isComplete);
  const incompletas = rows.filter((r) => !isComplete(r));
  console.log(`Filas: ${rows.length} | completas: ${completas.length} | incompletas: ${incompletas.length}`);

  // El Excel de revisión se genera SIEMPRE (no toca DB).
  exportIncompletas(incompletas, FUENTE, REVISION);

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
