// tools/ingesta/parseTiendas.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import * as path from "path";
import { parseTiendas, isComplete, resolveStoreNames } from "./parseTiendas";

const FILE = path.join(__dirname, "../../datos/fuentes/tiendas.xlsx");

test("parseTiendas: 176 completas / 149 incompletas", () => {
  const rows = parseTiendas(FILE);
  const completas = rows.filter(isComplete);
  const incompletas = rows.filter((r) => !isComplete(r));
  assert.equal(completas.length, 176);
  assert.equal(incompletas.length, 149);
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
