// tools/ingesta/parseRutas.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import * as path from "path";
import { parseRutas, uniqueStores, type AdvisorRoutes } from "./parseRutas";

const RUTAS = path.join(__dirname, "../../datos/fuentes/rutas.xlsx");
const byName = (advs: AdvisorRoutes[], re: RegExp) =>
  advs.find((a) => re.test(a.sheetName.toUpperCase()))!;

test("parseRutas: 4 asesores; Elvis 10 rutas (rotación 2 semanas), los demás 5", () => {
  const advisors = parseRutas(RUTAS);
  assert.equal(advisors.length, 4);
  assert.equal(byName(advisors, /ELVIS/).routes.length, 10);
  assert.equal(byName(advisors, /WILLIAM|WILLIAN/).routes.length, 5);
  assert.equal(byName(advisors, /EDUWARD/).routes.length, 5);
  assert.equal(byName(advisors, /ZURITA/).routes.length, 5);
});

test("cada ruta tiene un conteo realista (sin bloques concatenados)", () => {
  const elvis = byName(parseRutas(RUTAS), /ELVIS/);
  const r1 = elvis.routes.find((r) => r.rutaNumber === 1)!;
  const r2 = elvis.routes.find((r) => r.rutaNumber === 2)!;
  assert.equal(r1.stores.length, 10);                 // antes 40 (bug)
  assert.equal(r2.stores.length, 8);                  // antes 32 (bug)
  assert.equal(r1.stores[0], "LOCATEL SAN MARTIN");
  assert.equal(r2.stores[0], "EMPORIUM C.C MIRANDA");
  // ninguna ruta debe tener tiendas duplicadas
  for (const adv of parseRutas(RUTAS))
    for (const r of adv.routes) {
      const upper = r.stores.map((s) => s.toUpperCase());
      assert.equal(new Set(upper).size, upper.length, `ruta ${adv.sheetName} R${r.rutaNumber} tiene duplicados`);
    }
});

test("uniqueStores devuelve 190 tiendas únicas", () => {
  assert.equal(uniqueStores(parseRutas(RUTAS)).length, 190);
});
