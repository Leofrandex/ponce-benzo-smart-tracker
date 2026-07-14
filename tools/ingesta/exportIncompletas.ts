// tools/ingesta/exportIncompletas.ts
import * as fs from "fs";
import * as path from "path";
import * as xlsx from "xlsx";
import { TiendaRow } from "./parseTiendas";

// Reconstruye el Excel de revisión: fila de encabezado original (índice 1 del
// archivo fuente) + filas incompletas crudas + columna "Qué falta".
export function exportIncompletas(incompletas: TiendaRow[], srcFile: string, outPath: string): void {
  const wb = xlsx.readFile(srcFile);
  const src = xlsx.utils.sheet_to_json<unknown[]>(
    wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null },
  ) as unknown[][];
  const header = (src[1] || []).slice();
  header.push("Qué falta");

  const body = incompletas.map((r) => {
    const row = (r.raw || []).slice();
    row[header.length - 1] = r.faltantes.join(", ");
    return row;
  });

  const outWb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet([header, ...body]);
  xlsx.utils.book_append_sheet(outWb, ws, "Incompletas");

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  xlsx.writeFile(outWb, outPath);
  console.log(`✓ Excel de incompletas: ${incompletas.length} filas → ${outPath}`);
}
