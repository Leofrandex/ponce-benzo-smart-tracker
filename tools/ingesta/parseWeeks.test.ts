// tools/ingesta/parseWeeks.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWeeks } from "./chains";

test("parseWeeks: separador punto, guion, vacío", () => {
  // "1-2-3-4" (semanal) y "1-3" (impares) se amplían a la semana 5 en meses de
  // 5 semanas — ver fix del 2026-07-29 (rutas vacías del 29 al 31 de julio).
  assert.deepEqual(parseWeeks("1-2-3-4"), [1, 2, 3, 4, 5]);
  assert.deepEqual(parseWeeks("1.3"), [1, 3, 5]);
  assert.deepEqual(parseWeeks("2.4"), [2, 4]);
  assert.deepEqual(parseWeeks(""), []);
  assert.deepEqual(parseWeeks(null), []);
  assert.deepEqual(parseWeeks("3.3.1"), [1, 3, 5]); // dedup + orden (impares → +5ª)
  assert.deepEqual(parseWeeks("6"), []);         // fuera de 1..5
});
