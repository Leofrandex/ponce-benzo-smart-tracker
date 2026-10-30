import { test } from "node:test";
import assert from "node:assert/strict";
import { ultimaVersionVista } from "./rutaPlan";

const v = (created_at: string | null) => ({ plan_id: null, effective_from: "2026-11-02", created_at, stops: [] });

test("ultimaVersionVista conserva microsegundos y devuelve el string original", () => {
  const a = "2026-11-10T14:03:22.123455+00:00";
  const b = "2026-11-10T14:03:22.123456+00:00";
  assert.equal(ultimaVersionVista([v(b), v(a)]), b);
  assert.equal(ultimaVersionVista([v(a), v(b), v(null)]), b);
});

test("ultimaVersionVista sin versiones es null", () => {
  assert.equal(ultimaVersionVista([]), null);
});
