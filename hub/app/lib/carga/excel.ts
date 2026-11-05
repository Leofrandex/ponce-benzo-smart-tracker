import type { FilaCruda } from "./validar";
import { CANALES, CANAL_LABEL } from "./canales";
import { normTexto } from "./normalizar";

export type TipoCarga = "tiendas" | "clientes";
export const MAX_FILAS = 2000;
export const MAX_BYTES = 5 * 1024 * 1024;

type Col = { clave: string; titulo: string; obligatoria: boolean };
const c = (clave: string, titulo: string, obligatoria = false): Col => ({ clave, titulo, obligatoria });

// Las claves son las que lee validar.ts.
export const COLUMNAS: Record<TipoCarga, Col[]> = {
  tiendas: [
    c("cliente", "Cliente", true), c("nombre", "Nombre", true), c("canal", "Canal", true),
    c("estado", "Estado", true), c("municipio", "Municipio", true), c("direccion", "Dirección", true),
    c("urbanizacion", "Urbanización"), c("ciudad", "Ciudad"), c("region", "Región"),
    c("latitud", "Latitud"), c("longitud", "Longitud"), c("pdv", "Código PDV"),
  ],
  clientes: [c("nombre", "Nombre", true), c("canal", "Canal", true), c("rif", "RIF"), c("vendedor", "Vendedor")],
};

const HOJA: Record<TipoCarga, string> = { tiendas: "Tiendas", clientes: "Clientes" };
const COLOR_OBLIGATORIA = "FFFDE68A";
const COLOR_OPCIONAL = "FFE5E7EB";

const titulo = (col: Col) => (col.obligatoria ? `${col.titulo} *` : col.titulo);

async function nuevoLibro() {
  const { default: ExcelJS } = await import("exceljs");
  return new ExcelJS.Workbook();
}

async function aBuffer(wb: { xlsx: { writeBuffer(): Promise<unknown> } }): Promise<ArrayBuffer> {
  const u = new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
}

function encabezado(ws: import("exceljs").Worksheet, cols: Col[]) {
  ws.addRow(cols.map(titulo));
  cols.forEach((col, i) => {
    const cell = ws.getRow(1).getCell(i + 1);
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: col.obligatoria ? COLOR_OBLIGATORIA : COLOR_OPCIONAL } };
    ws.getColumn(i + 1).width = Math.max(16, titulo(col).length + 4);
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

export async function crearPlantilla(tipo: TipoCarga): Promise<ArrayBuffer> {
  const wb = await nuevoLibro();
  const cols = COLUMNAS[tipo];
  const ws = wb.addWorksheet(HOJA[tipo]);
  encabezado(ws, cols);

  const canalCol = cols.findIndex((x) => x.clave === "canal") + 1;
  const lista = `"${CANALES.map((k) => CANAL_LABEL[k]).join(",")}"`;
  for (let r = 2; r <= MAX_FILAS + 1; r++) {
    ws.getCell(r, canalCol).dataValidation = { type: "list", allowBlank: true, formulae: [lista] };
  }

  const ins = wb.addWorksheet("Instrucciones");
  ins.getColumn(1).width = 100;
  [
    `Llene la hoja "${HOJA[tipo]}" a partir de la fila 2.`,
    `Columnas obligatorias (marcadas con *): ${cols.filter((x) => x.obligatoria).map((x) => x.titulo).join(", ")}.`,
    `Columnas opcionales: ${cols.filter((x) => !x.obligatoria).map((x) => x.titulo).join(", ")}.`,
    `Canales válidos: ${CANALES.map((k) => CANAL_LABEL[k]).join(", ")}.`,
    ...(tipo === "tiendas"
      ? ["Latitud y longitud: número decimal, con punto o coma (ej. 10.4806).", "Código PDV: formato PDV-0001 (opcional)."]
      : []),
    `Máximo ${MAX_FILAS} filas por archivo.`,
  ].forEach((l) => ins.addRow([l]));
  return aBuffer(wb);
}

// Valor de celda a texto plano: nunca "[object Object]".
function aTexto(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v !== "object") return String(v).trim();
  const o = v as Record<string, unknown>;
  if ("result" in o) return aTexto(o.result);
  if (Array.isArray(o.richText)) return o.richText.map((t) => String((t as { text?: unknown }).text ?? "")).join("").trim();
  if ("text" in o) return aTexto(o.text);
  return "";
}

export async function leerExcel(
  tipo: TipoCarga,
  buf: ArrayBuffer,
): Promise<{ filas: FilaCruda[] } | { errorGeneral: string }> {
  if (buf.byteLength > MAX_BYTES) return { errorGeneral: "El archivo pesa más de 5 MB." };
  const wb = await nuevoLibro();
  try {
    await wb.xlsx.load(buf);
  } catch {
    return { errorGeneral: "El archivo no es un Excel válido (.xlsx)." };
  }
  const ws = wb.getWorksheet(HOJA[tipo]) ?? wb.worksheets[0];
  if (!ws) return { errorGeneral: "El archivo no parece un libro de Excel (no tiene hojas)." };

  const cols = COLUMNAS[tipo];
  const indice = new Map<number, string>();
  ws.getRow(1).eachCell((cell, n) => {
    const k = normTexto(aTexto(cell.value).replace(/\*/g, ""));
    const col = cols.find((x) => normTexto(x.titulo) === k || x.clave === k);
    if (col && !Array.from(indice.values()).includes(col.clave)) indice.set(n, col.clave);
  });
  const faltan = cols.filter((x) => x.obligatoria && !Array.from(indice.values()).includes(x.clave));
  if (faltan.length) return { errorGeneral: `Faltan columnas obligatorias: ${faltan.map((x) => x.titulo).join(", ")}.` };

  const filas: FilaCruda[] = [];
  let excedido = false;
  ws.eachRow((row, n) => {
    if (n < 2 || excedido) return;
    const valores: Record<string, string> = {};
    indice.forEach((clave, col) => {
      const t = aTexto(row.getCell(col).value);
      if (t) valores[clave] = t;
    });
    if (!Object.keys(valores).length) return;
    if (filas.length >= MAX_FILAS) { excedido = true; return; }
    filas.push({ fila: n, valores });
  });
  if (excedido) return { errorGeneral: `El archivo tiene más de ${MAX_FILAS} filas.` };
  return { filas };
}

export async function crearExcelErrores(
  tipo: TipoCarga,
  filas: { fila: number; valores: Record<string, string>; errores: string[] }[],
): Promise<ArrayBuffer> {
  const wb = await nuevoLibro();
  const cols = COLUMNAS[tipo];
  const ws = wb.addWorksheet(HOJA[tipo]);
  encabezado(ws, [...cols, c("errores", "Errores")]);
  ws.getColumn(cols.length + 1).width = 60;
  for (const f of filas) ws.addRow([...cols.map((x) => f.valores[x.clave] ?? ""), f.errores.join("; ")]);
  return aBuffer(wb);
}
