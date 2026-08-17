// tools/ingesta/parseProductos.ts
import * as XLSX from "xlsx";

export interface ProductoRow {
  sku: string;
  name: string;
  brand: string | null;
  ean13: string | null;
  ean14: string | null;
  unit: string | null;
  unit_case: string | null;
}

// El Excel del cliente llega con la codificacion rota (BA<U+FFFD>O por BAÑO).
// Solo aparece sobre la Ñ en este catalogo; si mañana aparecen acentos rotos,
// se agregan aca y el test correspondiente.
const REEMPLAZOS: Array<[RegExp, string]> = [[/\uFFFD/g, "Ñ"]];

export function repararTexto(s: string): string {
  let out = String(s ?? "");
  for (const [re, val] of REEMPLAZOS) out = out.replace(re, val);
  return out.replace(/\s+/g, " ").trim();
}

// Los prefijos no son uniformes en el archivo del cliente: conviven "DIOX.",
// "DIOX " y "DIOXOGEN". Se listan de mas especifico a mas generico.
const MARCAS: Array<[RegExp, string]> = [
  [/^DIOXOGEN\b|^DIOX[.\s]/i, "Dioxogen"],
  [/^OVERSKIN\b/i,            "Overskin"],
  [/^PHFEM\b/i,               "PHFem"],
  [/^DENCORUB\b|^DENCO\b/i,   "Dencorub"],
  [/^VITENOL\b/i,             "Vitenol"],
  [/^ADEL\b/i,                "Adel"],
  [/^WAMPOLE\b/i,             "Wampole"],
];

export function derivarMarca(descripcion: string): string | null {
  const d = repararTexto(descripcion);
  for (const [re, marca] of MARCAS) if (re.test(d)) return marca;
  return null;
}

const COL = { sku: 0, name: 1, ean13: 4, ean14: 5, unit: 6, unit_case: 7 } as const;
const PRIMERA_FILA_DATOS = 8; // base 0: la fila 9 del Excel

const texto = (v: unknown): string | null => {
  const s = v == null ? "" : repararTexto(String(v));
  return s === "" ? null : s;
};

export function parseProductos(rutaXlsx: string): ProductoRow[] {
  const wb = XLSX.readFile(rutaXlsx);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: false });

  const out: ProductoRow[] = [];
  for (const fila of filas.slice(PRIMERA_FILA_DATOS)) {
    const sku = texto(fila?.[COL.sku]);
    const name = texto(fila?.[COL.name]);
    if (!sku || !name) continue; // filas vacias o de subtotal
    out.push({
      sku,
      name,
      brand: derivarMarca(name),
      ean13: texto(fila?.[COL.ean13]),
      ean14: texto(fila?.[COL.ean14]),
      unit: texto(fila?.[COL.unit]),
      unit_case: texto(fila?.[COL.unit_case]),
    });
  }
  return out;
}
