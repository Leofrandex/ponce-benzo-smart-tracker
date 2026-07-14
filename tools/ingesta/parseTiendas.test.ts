// tools/ingesta/parseTiendas.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import * as path from "path";
import { parseTiendas, isComplete, resolveStoreNames, markCoordCollisions, TiendaRow } from "./parseTiendas";

const FILE = path.join(__dirname, "../../datos/fuentes/tiendas.xlsx");

test("parseTiendas: 191 completas / 134 incompletas (sin guard de colisión)", () => {
  const rows = parseTiendas(FILE);
  const completas = rows.filter(isComplete);
  const incompletas = rows.filter((r) => !isComplete(r));
  assert.equal(completas.length, 191);
  assert.equal(incompletas.length, 134);
});

test("markCoordCollisions sobre archivo real: degrada 4 (2 pares) → 187 completas", () => {
  const rows = parseTiendas(FILE);
  const conflicts = markCoordCollisions(rows);
  assert.equal(conflicts.length, 2);
  assert.equal(rows.filter(isComplete).length, 187);
});

test("parseTiendas: 'ARCO' completa, Farmatodo, Elvis Rondon, martes(4=jue?) ...", () => {
  const rows = parseTiendas(FILE);
  const arco = rows.find((r) => r.nombreTienda === "ARCO")!;
  assert.ok(arco);
  assert.equal(arco.cliente, "FARMATODO,C.A.");
  assert.equal(arco.merch, "ELVIS RONDON");
  assert.deepEqual(arco.weekdays, [4]); // JUE
  assert.deepEqual(arco.weeks, [1, 2, 3, 4]);
  assert.ok(isComplete(arco));
});

test("markCoordCollisions: dos tiendas distintas misma coord → coord_duplicada; misma tienda repetida NO", () => {
  const mk = (nombre: string, cliente: string, lat: number, lng: number): TiendaRow => ({
    rowIndex: 0, raw: [], cliente, canal: "Cadenas de Farmacias", tienda2: "",
    nombreTienda: nombre, lat, lng, municipio: null, ciudad: null, estado: null,
    direccion: null, region: null, merch: "ELVIS RONDON", encargado: null, telefono: null,
    email: null, birthday: null, weekdays: [1], weeks: [1], faltantes: [],
  });
  const rows = [
    mk("EL AVILA", "FARMATODO,C.A.", 10.50539, -66.90167),
    mk("LA CANDELARIA", "FARMATODO,C.A.", 10.50539, -66.90167), // colisión (nombre distinto)
    mk("ARCO", "FARMATODO,C.A.", 10.49054, -66.92497),           // única
    mk("DUP", "FARMATODO,C.A.", 10.40000, -66.40000),
    mk("DUP", "FARMATODO,C.A.", 10.40000, -66.40000),            // mismo nombre+coord: NO conflicto
  ];
  const conflicts = markCoordCollisions(rows);
  assert.equal(conflicts.length, 1);
  assert.ok(rows[0].faltantes.includes("coord_duplicada"));
  assert.ok(rows[1].faltantes.includes("coord_duplicada"));
  assert.ok(isComplete(rows[2]));                                 // ARCO intacta
  assert.ok(isComplete(rows[3]) && isComplete(rows[4]));          // DUP homónima no se marca
});

test("resolveStoreNames: desempate municipio y luego índice", () => {
  const names = resolveStoreNames([
    { prefix: "LOCATEL", nombre: "LAS MERCEDES", municipio: "BARUTA" },
    { prefix: "LOCATEL", nombre: "LAS MERCEDES", municipio: "LIBERTADOR" },
    { prefix: "LOCATEL", nombre: "LA TRINIDAD", municipio: "BARUTA" },
    { prefix: "LOCATEL", nombre: "LA TRINIDAD", municipio: "BARUTA" },
    { prefix: "FTD", nombre: "ARCO", municipio: "LIBERTADOR" },
  ]);
  assert.deepEqual(names, [
    "LOCATEL LAS MERCEDES (BARUTA)",
    "LOCATEL LAS MERCEDES (LIBERTADOR)",
    "LOCATEL LA TRINIDAD (1)",
    "LOCATEL LA TRINIDAD (2)",
    "FTD ARCO",
  ]);
});
