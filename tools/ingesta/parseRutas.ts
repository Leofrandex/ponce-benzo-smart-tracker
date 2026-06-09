// tools/ingesta/parseRutas.ts
import * as xlsx from "xlsx";
import { cleanStoreName, storeKey } from "./helpers";

export interface AdvisorRoutes {
  sheetName: string;                                  // nombre crudo de la celda "NOMBRE: ..."
  routes: { rutaNumber: number; stores: string[] }[]; // una por "Ruta N" distinta
}

// Las 4 hojas de asesor (la 5 sin nombre se excluye — pendiente).
const ADVISOR_SHEETS = ["1", "2", "3", "4"];
// Cada hoja tiene varios BLOQUES apilados. En cada bloque, el encabezado "Ruta N"
// va en las columnas 0,2,4,6,8; el nombre de tienda va en la columna siguiente (col+1).
const HEADER_COLS = [0, 2, 4, 6, 8];

export function parseRutas(filePath: string): AdvisorRoutes[] {
  const wb = xlsx.readFile(filePath);
  const advisors: AdvisorRoutes[] = [];

  for (const sheet of ADVISOR_SHEETS) {
    const ws = wb.Sheets[sheet];
    if (!ws) continue;
    const rows = xlsx.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null }) as unknown[][];

    // Nombre del asesor: celda que contiene "NOMBRE" (fila ~2).
    let sheetName = `Hoja ${sheet}`;
    for (let r = 0; r < Math.min(rows.length, 5); r++) {
      const cell = (rows[r] || []).find((c) => typeof c === "string" && /NOMBRE/i.test(c));
      if (cell) { sheetName = String(cell).replace(/.*NOMBRE:?/i, "").trim(); break; }
    }

    // Filas-encabezado de bloque: contienen "Ruta N" en alguna HEADER_COL.
    const headers: { row: number; labels: (number | null)[] }[] = [];
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] || [];
      const labels = HEADER_COLS.map((c) => {
        const v = row[c];
        if (typeof v === "string") {
          const m = v.trim().match(/^Ruta\s*(\d+)/i);
          if (m) return parseInt(m[1], 10);
        }
        return null;
      });
      if (labels.some((x) => x !== null)) headers.push({ row: r, labels });
    }

    // Por bloque, leer cada columna desde 2 filas bajo el encabezado (saltea la fila
    // de día) hasta el siguiente encabezado o el fin. El PRIMER bloque que define una
    // "Ruta N" gana: los bloques apilados repetidos son copias (no nuevas paradas).
    const byRuta = new Map<number, string[]>();
    headers.forEach((h, hi) => {
      const endRow = hi + 1 < headers.length ? headers[hi + 1].row : rows.length;
      h.labels.forEach((rutaNumber, ci) => {
        if (rutaNumber === null || byRuta.has(rutaNumber)) return;
        const nameCol = HEADER_COLS[ci] + 1;
        const stores: string[] = [];
        const seenInRoute = new Set<string>();
        for (let r = h.row + 2; r < endRow; r++) {
          const v = (rows[r] || [])[nameCol];
          if (v == null) continue;
          const name = cleanStoreName(String(v));
          if (!name || !isNaN(Number(name))) continue; // saltar vacíos y numéricos
          const k = storeKey(name);
          if (seenInRoute.has(k)) continue; // dedup: misma tienda repetida en la misma ruta
          seenInRoute.add(k);
          stores.push(name);
        }
        byRuta.set(rutaNumber, stores);
      });
    });

    const routes = [...byRuta.entries()]
      .map(([rutaNumber, stores]) => ({ rutaNumber, stores }))
      .sort((a, b) => a.rutaNumber - b.rutaNumber);
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
