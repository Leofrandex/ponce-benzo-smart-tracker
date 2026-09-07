import { test } from "node:test";
import assert from "node:assert/strict";
import { isRecentPing, formatAgo, LIVE_WINDOW_MIN } from "./liveness";

const NOW = "2026-09-06T18:00:00.000Z";

test("un ping de hace 5 min cuenta como activo", () => {
  assert.equal(isRecentPing("2026-09-06T17:55:00.000Z", NOW), true);
});

test("un ping justo dentro de la ventana cuenta como activo", () => {
  const edge = new Date(Date.parse(NOW) - LIVE_WINDOW_MIN * 60_000).toISOString();
  assert.equal(isRecentPing(edge, NOW), true);
});

test("un ping de hace 2 días NO cuenta como activo (sesión olvidada abierta)", () => {
  assert.equal(isRecentPing("2026-09-04T19:48:41.508+00:00", NOW), false);
});

test("timestamp inválido nunca es activo", () => {
  assert.equal(isRecentPing("no-es-fecha", NOW), false);
});

test("formatAgo describe la antigüedad en lenguaje humano", () => {
  assert.equal(formatAgo("2026-09-06T17:59:30.000Z", NOW), "hace menos de 1 min");
  assert.equal(formatAgo("2026-09-06T17:45:00.000Z", NOW), "hace 15 min");
  assert.equal(formatAgo("2026-09-06T15:00:00.000Z", NOW), "hace 3 h");
  assert.equal(formatAgo("2026-09-04T19:48:41.508+00:00", NOW), "hace 1 día");
  assert.equal(formatAgo("2026-09-01T10:00:00.000Z", NOW), "hace 5 días");
});
