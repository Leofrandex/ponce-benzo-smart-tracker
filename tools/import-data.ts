import { makeServiceClient } from "./ingesta/supabase";
import { stageUsers } from "./ingesta/stageUsers";
import { stageStores } from "./ingesta/stageStores";
import { stageClients } from "./ingesta/stageClients";
import { stageFarmatodoStores } from "./ingesta/stageFarmatodoStores";
import { stageFarmatodoRoutes } from "./ingesta/stageFarmatodoRoutes";
import { deactivateNonPilot } from "./ingesta/deactivateNonPilot";

async function main() {
  console.log("=== Ingesta Ponzivenzo (piloto Farmatodo) — inicio ===");
  const supabase = makeServiceClient();
  await stageUsers(supabase);
  await stageStores(supabase);
  await stageClients(supabase);
  const pilot = await stageFarmatodoStores(supabase);
  await stageFarmatodoRoutes(supabase, pilot);
  await deactivateNonPilot(supabase, pilot);
  console.log("=== Ingesta completada ===");
}
main().catch((e) => { console.error("ERROR de ingesta:", e.message); process.exit(1); });
