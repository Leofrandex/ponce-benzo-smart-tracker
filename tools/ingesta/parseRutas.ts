// tools/ingesta/parseRutas.ts
import * as xlsx from "xlsx";
import { cleanStoreName, storeKey } from "./helpers";

export interface AdvisorRoutes {
  sheetName: string;             // nombre crudo leído de la celda "NOMBRE: ..."
  routes: { weekday: number; stores: string[] }[]; // weekday 0=Lun..4=Vie
}

// Las 4 hojas de asesor (la 5 sin nombre se excluye — pendiente).
const ADVISOR_SHEETS = ["1", "2", "3", "4"];
// Por cada "Ruta N" la columna del nombre de tienda es 1,3,5,7,9.
const STORE_COLS = [1, 3, 5, 7, 9];

export function parseRutas(filePath: string): AdvisorRoutes[] {
  const wb = xlsx.readFile(filePath);
  const advisors: AdvisorRoutes[] = [];

  for (const sheet of ADVISOR_SHEETS) {
    const ws = wb.Sheets[sheet];
    if (!ws) continue;
    const rows = xlsx.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null }) as unknown[][];

    // Nombre del asesor: celda que contiene "NOMBRE" (fila ~2)
    let sheetName = `Hoja ${sheet}`;
    for (let r = 0; r < Math.min(rows.length, 5); r++) {
      const cell = (rows[r] || []).find((c) => typeof c === "string" && /NOMBRE/i.test(c));
      if (cell) { sheetName = String(cell).replace(/.*NOMBRE:?/i, "").trim(); break; }
    }

    const routes = STORE_COLS.map((col, weekday) => {
      const stores: string[] = [];
      for (let r = 5; r < rows.length; r++) {
        const v = (rows[r] || [])[col];
        if (v == null) continue;
        const name = cleanStoreName(String(v));
        if (!name || !isNaN(Number(name))) continue; // saltar vacíos y numéricos
        stores.push(name);
      }
      return { weekday, stores };
    });

    advisors.push({ sheetName, routes });
  }
  return advisors;
}

// Lista de tiendas únicas (por clave normalizada), conservando el primer nombre visto.
export function uniqueStores(advisors: AdvisorRoutes[]): string[] {
  const seen = new Map<string, string>();
  for (const a of advisors)
    for (const r of a.routes)
      for (const s of r.stores)
        if (!seen.has(storeKey(s))) seen.set(storeKey(s), s);
  return [...seen.values()];
}
