import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryDb } from "../testing/sqliteAdapter";
import { initSchema, getMeta } from "../store/localStore";
import { startSession, endSession, isAdhocSession } from "./sessionStore";

const P = { userId: "u", routeId: "r", startLat: null, startLng: null, appVersion: "t" };
async function fresh() { const db = memoryDb(); await initSchema(db); return db; }

test("startSession: guarda el id del OTA", async () => {
  const db = await fresh();
  const sid = await startSession(db, { ...P, otaId: "ota-1" });
  const r = await db.getFirstAsync<{ ota_update_id: string }>("SELECT ota_update_id FROM sessions WHERE session_id = ?", sid);
  assert.equal(r?.ota_update_id, "ota-1");
});

test("isAdhocSession: solo la jornada abierta como reporte suelto", async () => {
  const db = await fresh();
  const sid = await startSession(db, { ...P, adhoc: true });
  assert.equal(await isAdhocSession(db, sid), true);
  assert.equal(await isAdhocSession(db, "otra"), false);
  assert.equal(await isAdhocSession(db, undefined), false);
});

test("una jornada normal limpia la marca y arranca normal", async () => {
  const db = await fresh();
  const a = await startSession(db, { ...P, adhoc: true });
  const n = await startSession(db, P);
  assert.equal(await isAdhocSession(db, a), false);
  assert.equal(await isAdhocSession(db, n), false);
  assert.equal(await getMeta(db, "adhoc_session_id"), null);
});

test("terminar la jornada suelta limpia la marca", async () => {
  const db = await fresh();
  const sid = await startSession(db, { ...P, adhoc: true });
  assert.equal(await endSession(db, "u"), sid);
  assert.equal(await getMeta(db, "adhoc_session_id"), null);
});
