import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCoords } from "./stores";

test("validateCoords acepta coordenadas válidas y rechaza fuera de rango / NaN", () => {
  assert.equal(validateCoords(10.4806, -66.9036), true);
  assert.equal(validateCoords(0, 0), true);
  assert.equal(validateCoords(91, 0), false);
  assert.equal(validateCoords(0, 181), false);
  assert.equal(validateCoords(-91, 0), false);
  assert.equal(validateCoords(NaN, 0), false);
  assert.equal(validateCoords(10, Infinity), false);
});
