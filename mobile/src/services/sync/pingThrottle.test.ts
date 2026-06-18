import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldEmitPing } from "./pingThrottle";

test("shouldEmitPing: primera vez (sin último) => true", () => {
  assert.equal(shouldEmitPing(null, 1_000_000), true);
});
test("shouldEmitPing: antes del intervalo => false", () => {
  assert.equal(shouldEmitPing(1_000_000, 1_010_000, 30_000), false); // 10s < 30s
});
test("shouldEmitPing: en/after el intervalo => true", () => {
  assert.equal(shouldEmitPing(1_000_000, 1_030_000, 30_000), true);  // 30s == 30s
  assert.equal(shouldEmitPing(1_000_000, 1_045_000, 30_000), true);  // 45s > 30s
});
