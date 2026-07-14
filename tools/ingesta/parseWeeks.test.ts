// tools/ingesta/parseWeeks.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWeeks } from "./chains";

test("parseWeeks: separador punto, guion, vacío", () => {
  assert.deepEqual(parseWeeks("1-2-3-4"), [1, 2, 3, 4]);
  assert.deepEqual(parseWeeks("1.3"), [1, 3]);
  assert.deepEqual(parseWeeks("2.4"), [2, 4]);
  assert.deepEqual(parseWeeks(""), []);
  assert.deepEqual(parseWeeks(null), []);
  assert.deepEqual(parseWeeks("3.3.1"), [1, 3]); // dedup + orden
  assert.deepEqual(parseWeeks("6"), []);         // fuera de 1..5
});
