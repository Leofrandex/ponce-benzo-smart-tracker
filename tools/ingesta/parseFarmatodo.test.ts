import { test } from "node:test";
import assert from "node:assert/strict";
import * as path from "path";
import { parseFarmatodo } from "./parseFarmatodo";

const FILE = path.join(__dirname, "../../datos/fuentes/coordenadas-farmatodo.xlsx");
test("parseFarmatodo: 45 filas con coords + ruteo", () => {
  const rows = parseFarmatodo(FILE);
  assert.equal(rows.length, 45);
  const cuarzo = rows.find((r) => r.nombreTienda === "CUARZO")!;
  assert.ok(Math.abs(cuarzo.lat - 10.4946) < 0.01);
  assert.equal(cuarzo.merch, "WILLIAN FERMAN");
  assert.deepEqual(cuarzo.weekdays, [1]);
  const olivo = rows.find((r) => r.nombreTienda === "OLIVO")!;
  assert.deepEqual(olivo.weekdays, [1, 5]);
});
