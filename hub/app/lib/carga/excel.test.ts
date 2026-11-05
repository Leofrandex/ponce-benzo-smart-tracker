import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { COLUMNAS, MAX_FILAS, crearExcelErrores, crearPlantilla, leerExcel } from "./excel";

async function abrir(buf: ArrayBuffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb;
}

async function libro(filas: unknown[][]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Hoja1");
  filas.forEach((f) => ws.addRow(f as ExcelJS.CellValue[]));
  const u = new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
}

test("plantilla ida y vuelta: encabezados reconocidos, sin filas", async () => {
  const r = await leerExcel("tiendas", await crearPlantilla("tiendas"));
  assert.deepEqual(r, { filas: [] });
});
test("plantilla: obligatorias marcadas con * y color, con hoja Instrucciones", async () => {
  const wb = await abrir(await crearPlantilla("tiendas"));
  const encabezados = wb.getWorksheet("Tiendas")!.getRow(1);
  assert.equal(encabezados.getCell(1).value, "Cliente *");
  assert.equal(encabezados.getCell(1).font?.bold, true);
  assert.ok(encabezados.getCell(1).fill);
  assert.ok(wb.getWorksheet("Instrucciones"));
});
test("claves de COLUMNAS coinciden con las que lee validar.ts", () => {
  assert.deepEqual(
    COLUMNAS.tiendas.map((c) => c.clave),
    ["cliente", "nombre", "canal", "estado", "municipio", "direccion", "urbanizacion", "ciudad", "region", "latitud", "longitud", "pdv"],
  );
  assert.deepEqual(COLUMNAS.clientes.map((c) => c.clave), ["nombre", "canal", "rif", "vendedor"]);
});
test("leer: columnas en otro orden y otra capitalización", async () => {
  const r = await leerExcel("clientes", await libro([["canal *", "NOMBRE"], ["farmacia", "Gama"]]));
  assert.deepEqual((r as any).filas[0], { fila: 2, valores: { nombre: "Gama", canal: "farmacia" } });
});
test("leer: falta una obligatoria da error general", async () => {
  const r = await leerExcel("clientes", await libro([["Nombre"], ["Gama"]]));
  assert.match((r as any).errorGeneral, /Canal/);
});
test("leer: filas vacías se ignoran y el número de fila es el del Excel", async () => {
  const r = await leerExcel("clientes", await libro([["Nombre", "Canal"], ["", ""], ["Gama", "otro"]]));
  assert.equal((r as any).filas[0].fila, 3);
});
test("leer: números y fórmulas llegan como texto de su valor", async () => {
  const r = await leerExcel("clientes", await libro([["Nombre", "Canal", "RIF"], [{ formula: "\"A\"&\"B\"", result: "AB" }, "otro", 123]]));
  assert.deepEqual((r as any).filas[0].valores, { nombre: "AB", canal: "otro", rif: "123" });
});
test("leer: texto enriquecido e hipervínculo llegan como texto plano", async () => {
  const r = await leerExcel("clientes", await libro([["Nombre", "Canal", "RIF"], [
    { richText: [{ text: "Ga" }, { text: "ma", font: { bold: true } }] }, "otro",
    { text: "J-1", hyperlink: "http://x.com" },
  ]]));
  assert.deepEqual((r as any).filas[0].valores, { nombre: "Gama", canal: "otro", rif: "J-1" });
});
test("leer: más de MAX_FILAS da error general", async () => {
  const filas = [["Nombre", "Canal"], ...Array(MAX_FILAS + 1).fill(["A", "otro"])];
  assert.match((await leerExcel("clientes", await libro(filas)) as any).errorGeneral, /2000/);
});
test("leer: archivo que no es Excel da error general amable", async () => {
  const r = await leerExcel("clientes", new TextEncoder().encode("hola").buffer as ArrayBuffer);
  assert.match((r as any).errorGeneral, /Excel/);
});
test("errores: columna Errores al final con los mensajes", async () => {
  const wb = await abrir(await crearExcelErrores("clientes", [{ fila: 3, valores: { nombre: "A" }, errores: ["x", "y"] }]));
  const ws = wb.worksheets[0];
  assert.equal(ws.getRow(1).getCell(5).value, "Errores");
  assert.equal(ws.getRow(2).getCell(1).value, "A");
  assert.equal(ws.getRow(2).getCell(5).value, "x; y");
});
