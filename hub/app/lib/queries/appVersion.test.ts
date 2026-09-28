import { test } from "node:test";
import assert from "node:assert/strict";
import { compararVersiones, estadoVersion, ultimaVersionPorUsuario, VERSION_VIGENTE } from "./appVersion";

test("compararVersiones compara por número, no por texto", () => {
  assert.ok(compararVersiones("1.10.0", "1.9.0") > 0);
  assert.ok(compararVersiones("1.2.0", "1.3.0") < 0);
  assert.equal(compararVersiones("1.3.0", "1.3.0"), 0);
  assert.equal(compararVersiones("1.3", "1.3.0"), 0);
});

test("estadoVersion: vigente, anterior y sin dato", () => {
  assert.deepEqual(estadoVersion(VERSION_VIGENTE), { texto: "v1.3.0", desactualizada: false });
  assert.deepEqual(estadoVersion("1.4.0"), { texto: "v1.4.0", desactualizada: false });
  assert.deepEqual(estadoVersion("1.2.0"), { texto: "v1.2.0", desactualizada: true });
  assert.deepEqual(estadoVersion(null), { texto: "Anterior a 1.3.0", desactualizada: true });
  assert.deepEqual(estadoVersion(undefined), { texto: "Anterior a 1.3.0", desactualizada: true });
});

test("ultimaVersionPorUsuario toma la jornada más reciente (filas en orden desc), aunque sea null", () => {
  const m = ultimaVersionPorUsuario([
    { user_id: "a", app_version: null, session_start: "2026-09-28T12:00:00Z" },
    { user_id: "a", app_version: "1.3.0", session_start: "2026-09-27T12:00:00Z" },
    { user_id: "b", app_version: "1.3.0", session_start: "2026-09-26T12:00:00Z" },
  ]);
  assert.equal(m.get("a"), null);
  assert.equal(m.get("b"), "1.3.0");
  assert.equal(m.has("c"), false);
});
