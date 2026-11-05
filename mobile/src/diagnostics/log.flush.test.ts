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

test("flushDeviceLogs: si falla la lectura no lanza", async () => {
  const db = memoryDb(); // sin esquema: el SELECT lanza
  assert.equal(await flushDeviceLogs(db, sb([], () => ({ error: null })), "u"), 0);
});
