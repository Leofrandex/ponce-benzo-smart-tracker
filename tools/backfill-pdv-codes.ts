// tools/backfill-pdv-codes.ts
//
// Pone en stores.pdv_code los códigos PDV que ya se conocen (datos/pdv-tiendas.json) y
// registra en store_code_aliases los alias y el código reservado.
// Por defecto solo informa; --commit escribe en producción. Repetirlo es seguro: solo
// escribe donde pdv_code está nulo y nunca le quita un código a otra tienda.
//
//   npx --prefix hub tsx tools/backfill-pdv-codes.ts [--lista <csv>] [--commit]
//
// --lista: archivo de Diego, con columnas ID_PDV y store_id. Separador ; o coma, sin comillas.
// ponytail: el formato real se ajusta cuando llegue el archivo.
import * as fs from "fs";
import * as path from "path";
import { makeServiceClient } from "./ingesta/supabase";

const MAPA = path.join(__dirname, "../datos/pdv-tiendas.json");
// El mismo formato que exige stores_pdv_code_formato: uno malo tumbaria el --commit a medias.
const FORMATO = /^PDV-[0-9]{4,}$/;
const RESERVADOS = [{ code: "PDV-0194", store_id: null, kind: "reservado", note: "Excelsior Gama, sin sucursal" }];

type Tienda = { store_id: string; pdv_code: string | null };
type AliasExistente = { code: string; store_id: string | null; kind: string | null };

const numero = (code: string) => Number(code.replace(/\D/g, ""));

export function resolverCodigos(mapa: Record<string, string>): { principal: Map<string, string>; alias: { code: string; store_id: string }[] } {
  const principal = new Map<string, string>();
  const alias: { code: string; store_id: string }[] = [];
  for (const [code, store_id] of Object.entries(mapa).sort(([a], [b]) => numero(a) - numero(b))) {
    if (principal.has(store_id)) alias.push({ code, store_id });
    else principal.set(store_id, code);
  }
  return { principal, alias };
}

export function planificar(mapa: Record<string, string>, tiendas: Tienda[], aliasExistentes: AliasExistente[]) {
  const porId = new Map(tiendas.map((t) => [t.store_id, t]));
  const duenos = new Map(tiendas.filter((t) => t.pdv_code).map((t) => [t.pdv_code!, t.store_id]));
  const registrados = new Map(aliasExistentes.map((a) => [a.code, a]));
  const escribir: { store_id: string; code: string }[] = [];
  const alias: { code: string; store_id: string; kind: string; note: null }[] = [];
  const conflictos: string[] = [];
  const inexistentes: string[] = [];
  const malformados = Object.entries(mapa).filter(([code]) => !FORMATO.test(code)).map(([code, id]) => `${code} -> ${id}`);

  // Texto del choque si el código ya es de otro; null si está libre para esta tienda.
  const choque = (code: string, store_id: string | null): string | null => {
    const dueno = duenos.get(code);
    if (dueno && dueno !== store_id) return `${code} ya lo tiene la tienda ${dueno}`;
    const r = registrados.get(code);
    if (r && r.store_id !== store_id) return `${code} ya está registrado como ${r.kind ?? "alias"} de ${r.store_id ?? "ninguna tienda"}`;
    return null;
  };
  const agregarAlias = (code: string, store_id: string) => {
    const c = choque(code, store_id);
    if (c) conflictos.push(c);
    // Lo ya registrado no se reenvia: el upsert pisaria su kind y su note.
    else if (!registrados.has(code)) alias.push({ code, store_id, kind: "alias", note: null });
  };

  const r = resolverCodigos(Object.fromEntries(Object.entries(mapa).filter(([code]) => FORMATO.test(code))));
  for (const [store_id, code] of r.principal) {
    const t = porId.get(store_id);
    if (!t) { inexistentes.push(`${code} -> ${store_id}`); continue; }
    if (t.pdv_code === code) continue;
    // Con otro código ya puesto no se pisa: este queda como alias, para que la carga masiva lo detecte.
    if (t.pdv_code) { agregarAlias(code, store_id); continue; }
    const c = choque(code, store_id);
    if (c) conflictos.push(c);
    else escribir.push({ store_id, code });
  }
  for (const { code, store_id } of r.alias) {
    const t = porId.get(store_id);
    if (!t) inexistentes.push(`${code} -> ${store_id}`);
    else if (t.pdv_code !== code) agregarAlias(code, store_id);
  }

  const reservados = RESERVADOS.filter((x) => {
    const c = choque(x.code, null);
    if (c) conflictos.push(c);
    return !c && !registrados.has(x.code);
  });

  const sinCodigo = tiendas.filter((t) => !t.pdv_code).length - escribir.length;
  return { escribir, alias, reservados, sinCodigo, conflictos, inexistentes, malformados };
}

// `saltadas` nombra la fila del archivo. Una fila del todo vacia no se reporta.
export function parseLista(texto: string): { mapa: Record<string, string>; saltadas: string[] } {
  const lineas = texto.replace(/^\uFEFF/, "").split(/\r?\n/);
  const iCabecera = lineas.findIndex((l) => l.trim());
  const cabecera = lineas[iCabecera] ?? "";
  const sep = cabecera.includes(";") ? ";" : ",";
  const cab = cabecera.split(sep).map((c) => c.trim());
  const iCodigo = cab.indexOf("ID_PDV");
  const iTienda = cab.indexOf("store_id");
  if (iCodigo < 0 || iTienda < 0) throw new Error("La lista debe tener las columnas ID_PDV y store_id");
  const mapa: Record<string, string> = {};
  const saltadas: string[] = [];
  for (let i = iCabecera + 1; i < lineas.length; i++) {
    const c = lineas[i].split(sep).map((x) => x.trim());
    if (c.every((x) => !x)) continue;
    const code = (c[iCodigo] ?? "").toUpperCase();
    const store_id = c[iTienda] ?? "";
    if (!code || !store_id) { saltadas.push(`fila ${i + 1}: falta ID_PDV o store_id`); continue; }
    if (!FORMATO.test(code)) { saltadas.push(`fila ${i + 1}: código mal formado ${code}`); continue; }
    if (mapa[code] && mapa[code] !== store_id) throw new Error(`La lista trae ${code} con dos tiendas: ${mapa[code]} y ${store_id}`);
    mapa[code] = store_id;
  }
  return { mapa, saltadas };
}

export function leerLista(archivo: string): ReturnType<typeof parseLista> {
  if (!fs.existsSync(archivo)) throw new Error(`No existe el archivo de --lista: ${archivo}`);
  return parseLista(fs.readFileSync(archivo, "utf8"));
}

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes("--commit");
  const mapa: Record<string, string> = JSON.parse(fs.readFileSync(MAPA, "utf8"));
  const choquesLista: string[] = [];
  let saltadas: string[] = [];
  if (args.includes("--lista")) {
    const archivo = args[args.indexOf("--lista") + 1];
    if (!archivo || archivo.startsWith("--")) throw new Error("Uso: --lista <csv>");
    const lista = leerLista(archivo);
    saltadas = lista.saltadas;
    for (const [code, store_id] of Object.entries(lista.mapa)) {
      if (mapa[code] && mapa[code] !== store_id) choquesLista.push(`${code}: el JSON dice ${mapa[code]} y la lista ${store_id}; se deja el JSON`);
      else mapa[code] = store_id;
    }
  }

  const sb = makeServiceClient();
  const tiendas: Tienda[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await sb.from("stores").select("store_id,pdv_code").order("store_id").range(desde, desde + 999);
    if (error) throw new Error(`stores: ${error.message}`);
    tiendas.push(...(data as Tienda[]));
    if (data.length < 1000) break;
  }
  const { data: aliasExistentes, error: aliasError } = await sb.from("store_code_aliases").select("code,store_id,kind");
  if (aliasError) throw new Error(`store_code_aliases: ${aliasError.message}`);

  const p = planificar(mapa, tiendas, aliasExistentes as AliasExistente[]);
  const conflictos = [...choquesLista, ...p.conflictos];
  console.log(`=== Códigos PDV — ${commit ? "COMMIT (escribe en producción)" : "DRY-RUN"} ===`);
  console.log(`Códigos a escribir: ${p.escribir.length}`);
  console.log(`Alias a registrar: ${p.alias.length}`);
  console.log(`Reservados a registrar: ${p.reservados.length}`);
  console.log(`Tiendas que siguen sin código: ${p.sinCodigo}`);
  console.log(`Códigos con tienda inexistente (${p.inexistentes.length}): ${p.inexistentes.join(", ") || "-"}`);
  console.log(`Filas de la lista saltadas (${saltadas.length}):${saltadas.map((x) => `\n  ${x}`).join("") || " -"}`);
  console.log(`Códigos mal formados en el mapa, se saltan (${p.malformados.length}): ${p.malformados.join(", ") || "-"}`);
  console.log(`Códigos en conflicto, se saltan (${conflictos.length}):${conflictos.map((c) => `\n  ${c}`).join("") || " -"}`);

  if (!commit) { console.log("=== Dry-run completado (usa --commit para escribir) ==="); return; }

  let escritos = 0;
  for (const { store_id, code } of p.escribir) {
    const { data, error } = await sb.from("stores").update({ pdv_code: code }).eq("store_id", store_id).is("pdv_code", null).select("store_id");
    if (error) throw new Error(`pdv_code ${code}: ${error.message}`);
    escritos += data.length;
  }
  const filas = [...p.alias, ...p.reservados];
  if (filas.length) {
    const { error } = await sb.from("store_code_aliases").upsert(filas, { onConflict: "code", ignoreDuplicates: true });
    if (error) throw new Error(`store_code_aliases: ${error.message}`);
  }
  console.log(`=== Listo: ${escritos} códigos escritos, ${p.alias.length} alias, ${p.reservados.length} reservados, ${p.sinCodigo + p.escribir.length - escritos} tiendas sin código ===`);
}

if (require.main === module) {
  main().catch((e) => { console.error("✖", e.message); process.exit(1); });
}
