import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryDb } from "../testing/sqliteAdapter";
import { initSchema, getMeta } from "./localStore";
import { purgeLocal, purgeOrphanPhotos, purgeIfDue } from "./purge";
import type { PhotoFs } from "../services/photos/photoStore";

const DAY = 86_400_000;
const NOW = Date.parse("2026-11-05T12:00:00Z");
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();

async function fresh() { const db = memoryDb(); await initSchema(db); return db; }
const count = async (db: any, t: string) => (await db.getFirstAsync(`SELECT COUNT(*) AS n FROM ${t}`)).n as number;

async function visit(db: any, id: string, o: { days: number; synced?: number; ps?: number; uri?: string | null }) {
  await db.runAsync(
    `INSERT INTO visits (visit_id, store_id, user_id, check_in_time, status, synced, photos_synced, photo_uri) VALUES (?, 's', 'u', ?, 'ok', ?, ?, ?)`,
    id, ago(o.days), o.synced ?? 1, o.ps ?? 1, o.uri === undefined ? null : o.uri);
}

const INDEX_SQL = `SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'`;

test("initSchema: crea los indices en BD nueva y en una vieja sin columnas opcionales", async () => {
  const db = await fresh();
  assert.equal((await db.getAllAsync(INDEX_SQL)).length, 6);
  const old = memoryDb();
  await old.execAsync(`CREATE TABLE visits (visit_id TEXT PRIMARY KEY, session_id TEXT, store_id TEXT NOT NULL, user_id TEXT NOT NULL, check_in_time TEXT NOT NULL, status TEXT NOT NULL, synced INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE location_pings (ping_id TEXT PRIMARY KEY, session_id TEXT, timestamp TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL);
    CREATE TABLE competition_reports (report_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL, synced INTEGER NOT NULL DEFAULT 0);`);
  await initSchema(old); // los indices referencian columnas que se agregan en la migracion
  assert.equal((await old.getAllAsync(INDEX_SQL)).length, 6);
});

test("purgeLocal nunca borra lo no sincronizado", async () => {
  const db = await fresh();
  await visit(db, "v-unsynced", { days: 90, synced: 0 });
  await visit(db, "v-nophotos", { days: 90, synced: 1, ps: 0 });
  await db.runAsync(`INSERT INTO competition_reports (report_id, user_id, created_at, synced, photos_synced) VALUES ('r1','u',?,0,1), ('r2','u',?,1,0)`, ago(90), ago(90));
  await db.runAsync(`INSERT INTO location_pings (ping_id, timestamp, lat, lng, synced) VALUES ('p1',?,0,0,0)`, ago(90));
  await db.runAsync(`INSERT INTO sync_log (log_id, ts, level, event, synced) VALUES ('l1',?,'info','x',0)`, ago(90));
  await purgeLocal(db, NOW);
  assert.equal(await count(db, "visits"), 2);
  assert.equal(await count(db, "competition_reports"), 2);
  assert.equal(await count(db, "location_pings"), 1);
  assert.equal(await count(db, "sync_log"), 1);
});

test("purgeLocal conserva la visita si un vinculo sigue sin sincronizar", async () => {
  const db = await fresh();
  await visit(db, "v1", { days: 90 });
  await db.runAsync(`INSERT INTO visit_anomaly_products VALUES ('v1','a','p1',1), ('v1','a','p2',0)`);
  await visit(db, "v2", { days: 90 });
  await db.runAsync(`INSERT INTO restock_products VALUES ('v2','p1',0)`);
  await purgeLocal(db, NOW);
  assert.equal(await count(db, "visits"), 2);
  assert.equal(await count(db, "visit_anomaly_products"), 2);
  assert.equal(await count(db, "restock_products"), 1);
});

test("purgeLocal borra visitas de +30 dias con sus vinculos, pings y logs de +7 dias", async () => {
  const db = await fresh();
  await visit(db, "old", { days: 31 });
  await visit(db, "recent", { days: 29 });
  await db.runAsync(`INSERT INTO visit_anomaly_products VALUES ('old','a','p1',1), ('recent','a','p1',1)`);
  await db.runAsync(`INSERT INTO restock_products VALUES ('old','p1',1), ('recent','p1',1)`);
  await db.runAsync(`INSERT INTO competition_reports (report_id, user_id, created_at, synced, photos_synced) VALUES ('rold','u',?,1,1), ('rnew','u',?,1,1)`, ago(31), ago(29));
  await db.runAsync(`INSERT INTO location_pings (ping_id, timestamp, lat, lng, synced) VALUES ('pold',?,0,0,1), ('pnew',?,0,0,1)`, ago(8), ago(6));
  await db.runAsync(`INSERT INTO sync_log (log_id, ts, level, event, synced) VALUES ('lold',?,'info','x',1), ('lnew',?,'info','x',1)`, ago(8), ago(6));
  await db.runAsync(`INSERT INTO sessions (session_id, user_id, route_id, session_start, synced) VALUES ('s','u','r',?,1)`, ago(90));
  await purgeLocal(db, NOW);
  const ids = async (t: string, c: string) => (await db.getAllAsync<any>(`SELECT ${c} AS id FROM ${t}`)).map((r) => r.id);
  assert.deepEqual(await ids("visits", "visit_id"), ["recent"]);
  assert.deepEqual(await ids("visit_anomaly_products", "visit_id"), ["recent"]);
  assert.deepEqual(await ids("restock_products", "visit_id"), ["recent"]);
  assert.deepEqual(await ids("competition_reports", "report_id"), ["rnew"]);
  assert.deepEqual(await ids("location_pings", "ping_id"), ["pnew"]);
  assert.deepEqual(await ids("sync_log", "log_id"), ["lnew"]);
  assert.equal(await count(db, "sessions"), 1); // las sesiones no se purgan
});

function fakeFs(files: { uri: string; modifiedMs: number }[]) {
  const removed: string[] = [];
  const fs: PhotoFs = {
    ensureDir: async () => {}, copyToPermanent: async (u) => u, exists: async () => true,
    remove: async (u) => { removed.push(u); }, list: async () => files,
  };
  return { fs, removed };
}
const OLD = NOW - 10 * DAY;

test("purgeOrphanPhotos conserva fotos referenciadas por la cola (cualquier usuario, sincronizadas o no)", async () => {
  const db = await fresh();
  await visit(db, "v", { days: 1, synced: 0, uri: JSON.stringify(["file://a.jpg"]) });
  await db.runAsync(`INSERT INTO competition_reports (report_id, user_id, created_at, synced, photo_uri) VALUES ('r','otro',?,1,?)`, ago(1), JSON.stringify(["file://b.jpg"]));
  const { fs, removed } = fakeFs([{ uri: "file://a.jpg", modifiedMs: OLD }, { uri: "file://b.jpg", modifiedMs: OLD }, { uri: "file://huerfana.jpg", modifiedMs: OLD }]);
  assert.equal(await purgeOrphanPhotos(db, fs, NOW), 1);
  assert.deepEqual(removed, ["file://huerfana.jpg"]);
});

test("purgeOrphanPhotos borra solo huerfanas de +7 dias", async () => {
  const db = await fresh();
  const { fs, removed } = fakeFs([
    { uri: "file://vieja.jpg", modifiedMs: NOW - 8 * DAY },
    { uri: "file://reciente.jpg", modifiedMs: NOW - 6 * DAY }, // puede ser un borrador abierto
    { uri: "file://sinfecha.jpg", modifiedMs: 0 },
  ]);
  assert.equal(await purgeOrphanPhotos(db, fs, NOW), 1);
  assert.deepEqual(removed, ["file://vieja.jpg"]);
});

test("purgeOrphanPhotos: si algun photo_uri no se puede leer no borra nada", async () => {
  for (const bad of ["no-es-json", '{"a":1}', "[1,2]"]) {
    const db = await fresh();
    await visit(db, "v", { days: 1, uri: bad });
    const { fs, removed } = fakeFs([{ uri: "file://x.jpg", modifiedMs: OLD }]);
    assert.equal(await purgeOrphanPhotos(db, fs, NOW), 0);
    assert.deepEqual(removed, []);
  }
});

test("purgeOrphanPhotos: si la lectura de la tabla falla no borra nada", async () => {
  const db = memoryDb(); // sin esquema: SELECT lanza
  const { fs, removed } = fakeFs([{ uri: "file://x.jpg", modifiedMs: OLD }]);
  assert.equal(await purgeOrphanPhotos(db, fs, NOW), 0);
  assert.deepEqual(removed, []);
});

test("purgeIfDue: corre una vez cada 24 h, escribe last_purge al terminar y un fallo no lanza ni escribe", async () => {
  const db = await fresh();
  const { fs } = fakeFs([]);
  await purgeIfDue(db, fs, NOW);
  assert.equal(await getMeta(db, "last_purge"), String(NOW));
  await visit(db, "old", { days: 90 });
  await purgeIfDue(db, fs, NOW + 3600_000); // hace 1 h: no corre
  assert.equal(await count(db, "visits"), 1);
  await purgeIfDue(db, fs, NOW + 25 * 3600_000);
  assert.equal(await count(db, "visits"), 0);
  assert.equal(await getMeta(db, "last_purge"), String(NOW + 25 * 3600_000));
  const broken = memoryDb(); // sin esquema: todo falla
  await assert.doesNotReject(purgeIfDue(broken, fs, NOW));
});
