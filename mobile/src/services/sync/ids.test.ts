import { test } from "node:test";
import assert from "node:assert/strict";
import { newId } from "./ids";
test("newId: formato uuid v4 y único", () => {
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const a = newId(), b = newId();
  assert.match(a, re); assert.match(b, re); assert.notEqual(a, b);
});
