import { test } from "node:test";
import assert from "node:assert/strict";
import { nextPhotoRetry } from "./photoRetry";

test("espera creciente con tope", () => {
  const t = Date.parse("2026-11-04T10:00:00Z");
  assert.equal(nextPhotoRetry(0, t), "2026-11-04T10:01:00.000Z");
  assert.equal(nextPhotoRetry(3, t), "2026-11-04T10:08:00.000Z");
  assert.equal(nextPhotoRetry(20, t), "2026-11-04T11:00:00.000Z");
});
