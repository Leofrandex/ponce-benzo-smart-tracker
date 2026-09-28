import { test } from "node:test";
import assert from "node:assert/strict";
import { resizeTarget } from "./photoSize";

test("resizeTarget: horizontal grande → ancho 1600", () => {
  assert.deepEqual(resizeTarget(4000, 3000), { width: 1600 });
});
test("resizeTarget: vertical grande → alto 1600", () => {
  assert.deepEqual(resizeTarget(3000, 4000), { height: 1600 });
});
test("resizeTarget: ya chica → null (no se agranda)", () => {
  assert.equal(resizeTarget(1200, 900), null);
  assert.equal(resizeTarget(1600, 1200), null);
});
