import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryDb } from "../testing/sqliteAdapter";
import { initSchema } from "../store/localStore";
import { flushDeviceLogs } from "./log";

async function seeded() {
  const db = memoryDb(); await initSchema(db);
  for (const [id, u] of [["a", "u"], ["b", "u"], ["c", "otro"]]) {
    await db.runAsync(`INSERT INTO sync_log (log_id, ts, level, event, user_id, synced) VALUES (?, '2026-11-05T00:00:00Z', 'info', 'e', ?, 0)`, id, u);
  }
  return db;
}
const sb = (calls: any[], result: () => any) => ({ from: () => ({ upsert: (rows: any) => { calls.push(rows); return Promise.resolve(result()); } }) }) as any;
const synced = async (db: any) => (await db.getAllAsync(`SELECT log_id FROM sync_log WHERE synced = 1 ORDER BY log_id`)).map((r: any) => r.log_id);

test("flushDeviceLogs: un solo upsert de arreglo y marca solo los del usuario", async () => {
  const db = await seeded(); const calls: any[] = [];
  assert.equal(await flushDeviceLogs(db, sb(calls, () => ({ error: null })), "u"), 2);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].map((r: any) => r.log_id), ["a", "b"]);
  assert.deepEqual(await synced(db), ["a", "b"]);
});

test("flushDeviceLogs: con error no marca nada y no lanza", async () => {
  const db = await seeded();
  assert.equal(await flushDeviceLogs(db, sb([], () => ({ error: { message: "x" } })), "u"), 0);
  const thrower = { from: () => ({ upsert: () => Promise.reject(new Error("red")) }) } as any;
  assert.equal(await flushDeviceLogs(db, thrower, "u"), 0);
  assert.deepEqual(await synced(db), []);
});

const CHECK = { code: "23514", message: "viola un check" };

test("flushDeviceLogs: una fila rechazada no bloquea: uno a uno y todas quedan marcadas", async () => {
  const db = await seeded(); const calls: any[] = [];
  const malaEnLote = () => (calls.at(-1).some((r: any) => r.log_id === "a") ? { error: CHECK } : { error: null });
  assert.equal(await flushDeviceLogs(db, sb(calls, malaEnLote), "u"), 1, "solo cuenta la que subió");
  assert.deepEqual(calls.map((c) => c.map((r: any) => r.log_id)), [["a", "b"], ["a"], ["b"]]);
  assert.deepEqual(await synced(db), ["a", "b"]);
  // La pasada siguiente ya no la vuelve a mandar.
  assert.equal(await flushDeviceLogs(db, sb(calls, malaEnLote), "u"), 0);
  assert.equal(calls.length, 3);
});

test("flushDeviceLogs: sin red no reintenta uno a uno ni marca nada", async () => {
  const db = await seeded(); const calls: any[] = [];
  const net = { message: "TypeError: Network request failed", code: "" };
  assert.equal(await flushDeviceLogs(db, sb(calls, () => ({ error: net })), "u"), 0);
  assert.equal(calls.length, 1);
  assert.deepEqual(await synced(db), []);
  const thrower = { from: () => ({ upsert: () => Promise.reject(new TypeError("Network request failed")) }) } as any;
  assert.equal(await flushDeviceLogs(db, thrower, "u"), 0);
  assert.deepEqual(await synced(db), []);
});

test("flushDeviceLogs: si la red cae en el uno a uno, conserva lo hecho y para", async () => {
  const db = await seeded(); const calls: any[] = [];
  const result = () => (calls.length === 1 ? { error: CHECK } : calls.length === 2 ? { error: null } : { error: { message: "Network request failed", code: "" } });
  assert.equal(await flushDeviceLogs(db, sb(calls, result), "u"), 1);
  assert.deepEqual(await synced(db), ["a"]);
});

test("flushDeviceLogs: falla del servidor que no es culpa de la fila no descarta los logs", async () => {
  for (const error of [{ message: "Bad gateway" }, { code: "PGRST303", message: "JWT expired" }, { code: "PGRST000", message: "base caida" }]) {
    const db = await seeded(); const calls: any[] = [];
    assert.equal(await flushDeviceLogs(db, sb(calls, () => ({ error })), "u"), 0);
    assert.equal(calls.length, 2, "el lote y una fila; luego para");
    assert.deepEqual(await synced(db), [], JSON.stringify(error));
  }
});

test("flushDeviceLogs: statement timeout y permisos paran sin marcar nada", async () => {
  for (const code of ["57014", "42501", "25006"]) {
    const db = await seeded(); const calls: any[] = [];
    assert.equal(await flushDeviceLogs(db, sb(calls, () => ({ error: { code, message: "x" } })), "u"), 0);
    assert.equal(calls.length, 2, "el lote y una fila; luego para");
    assert.deepEqual(await synced(db), [], code);
  }
});

test("flushDeviceLogs: una fila con 23514 queda marcada como rechazada", async () => {
  const db = await seeded(); const calls: any[] = [];
  assert.equal(await flushDeviceLogs(db, sb(calls, () => ({ error: CHECK })), "u"), 0, "ninguna subió");
  assert.deepEqual(await synced(db), ["a", "b"]);
});

test("flushDeviceLogs: si falla la lectura no lanza", async () => {
  const db = memoryDb(); // sin esquema: el SELECT lanza
  assert.equal(await flushDeviceLogs(db, sb([], () => ({ error: null })), "u"), 0);
});
