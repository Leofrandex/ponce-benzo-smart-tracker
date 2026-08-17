// tools/import-products.ts
import * as path from "path";
import * as fs from "fs";
import { makeServiceClient } from "./ingesta/supabase";
import { parseProductos } from "./ingesta/parseProductos";

const FUENTE_INBOX = path.join(__dirname, "../datos/inbox/SKU EMPRESA.xlsx");
const FUENTE_PROCESADOS = path.join(__dirname, "../datos/procesados/SKU EMPRESA.xlsx");
const FUENTE = fs.existsSync(FUENTE_INBOX) ? FUENTE_INBOX : FUENTE_PROCESADOS;

async function main() {
  const commit = process.argv.includes("--commit");
  console.log(`=== Ingesta de productos — ${commit ? "COMMIT (escribe en produccion)" : "DRY-RUN (sin escrituras)"} ===`);

  const productos = parseProductos(FUENTE);
  const sinMarca = productos.filter((p) => p.brand === null);
  console.log(`Productos leidos: ${productos.length} | sin marca reconocida: ${sinMarca.length}`);
  for (const p of sinMarca) console.log(`   ⚠ sin marca: ${p.sku} ${p.name}`);

  const porMarca = new Map<string, number>();
  for (const p of productos) porMarca.set(p.brand ?? "(sin marca)", (porMarca.get(p.brand ?? "(sin marca)") ?? 0) + 1);
  for (const [marca, n] of [...porMarca].sort()) console.log(`   ${marca}: ${n}`);

  if (!commit) {
    console.log("\nDry-run: no se escribio nada. Volve a correr con --commit para cargar.");
    return;
  }

  // Upsert por sku: reimportar un archivo ampliado actualiza en vez de duplicar.
  const supabase = makeServiceClient();
  const { error } = await supabase
    .from("products")
    .upsert(productos.map((p) => ({ ...p, active: true })), { onConflict: "sku" });
  if (error) throw new Error(`upsert products: ${error.message}`);
  console.log(`✔ ${productos.length} productos cargados/actualizados.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
