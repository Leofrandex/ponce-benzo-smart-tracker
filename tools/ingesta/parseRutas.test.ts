// tools/ingesta/parseRutas.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import * as path from "path";
import { parseRutas, uniqueStores } from "./parseRutas";

const RUTAS = path.join(__dirname, "../../RUTAS 05-12-25 (1).xlsx");

test("parseRutas extrae 4 asesores con 5 rutas cada uno", () => {
  const advisors = parseRutas(RUTAS);
  assert.equal(advisors.length, 4);
  for (const a of advisors) assert.equal(a.routes.length, 5);
});

test("Elvis (hoja 1) tiene el nombre y los conteos esperados", () => {
  const advisors = parseRutas(RUTAS);
  const elvis = advisors.find((a) => /ELVIS/.test(a.sheetName.toUpperCase()));
  assert.ok(elvis, "debe existir el asesor Elvis");
  // Ruta 1 (lunes) = 40 paradas, Ruta 2 = 32
  assert.equal(elvis!.routes[0].stores.length, 40);
  assert.equal(elvis!.routes[1].stores.length, 32);
  assert.equal(elvis!.routes[0].stores[0], "LOCATEL SAN MARTIN");
});

test("uniqueStores devuelve 192 tiendas únicas", () => {
  const advisors = parseRutas(RUTAS);
  assert.equal(uniqueStores(advisors).length, 192);
});
