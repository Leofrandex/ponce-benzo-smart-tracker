import test from "node:test";
import assert from "node:assert/strict";
import { classifyError } from "./errorKind";

for (const m of ["Network request failed", "timeout 15000ms: visit v1", "Aborted", "Failed to fetch"])
  test(`classifyError red: ${m}`, () => assert.equal(classifyError(new Error(m)), "network"));
test("classifyError: AbortError es red", () => assert.equal(classifyError(Object.assign(new Error("x"), { name: "AbortError" })), "network"));
test("classifyError: error de PostgREST es servidor", () => assert.equal(classifyError({ code: "42501", message: "row-level security" }), "server"));
test("classifyError: desconocido es servidor", () => assert.equal(classifyError(new Error("algo raro")), "server"));
test("classifyError: null, undefined y strings no lanzan", () => {
  assert.equal(classifyError(null), "server");
  assert.equal(classifyError(undefined), "server");
  assert.equal(classifyError("algo raro"), "server");
  assert.equal(classifyError("Network request failed"), "network");
});
test("classifyError: objeto plano con message de red", () => assert.equal(classifyError({ message: "Failed to fetch" }), "network"));
