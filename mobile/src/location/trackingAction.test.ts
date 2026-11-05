import { test } from "node:test";
import assert from "node:assert/strict";
import { trackingAction } from "./trackingAction";

test("trackingAction: sin servicio arranca", () => assert.equal(trackingAction({ running: false, stale: true, lastRestartMs: null, nowMs: 1e6 }), "start"));
test("trackingAction: activo pero sin pings reinicia", () => assert.equal(trackingAction({ running: true, stale: true, lastRestartMs: null, nowMs: 1e6 }), "restart"));
test("trackingAction: respeta la espera entre reinicios", () => assert.equal(trackingAction({ running: true, stale: true, lastRestartMs: 1e6 - 1000, nowMs: 1e6 }), "none"));
test("trackingAction: pasada la espera vuelve a reiniciar", () => assert.equal(trackingAction({ running: true, stale: true, lastRestartMs: 1e6 - 300_000, nowMs: 1e6 }), "restart"));
test("trackingAction: sano no hace nada", () => assert.equal(trackingAction({ running: true, stale: false, lastRestartMs: null, nowMs: 1e6 }), "none"));
