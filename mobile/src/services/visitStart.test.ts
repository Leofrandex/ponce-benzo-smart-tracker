import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryDb } from '../testing/sqliteAdapter';
import { initSchema } from '../store/localStore';
import { getOrCreateVisitStart, clearVisitStart } from './visitStart';
import { insertVisit, type VisitRow } from './db';

async function fake() { const db = memoryDb(); await initSchema(db); return db; }

test('getOrCreateVisitStart conserva la primera apertura', async () => {
  const db = await fake();
  const a = await getOrCreateVisitStart(db, 'u', 's', new Date('2026-11-04T14:00:00Z'));
  const b = await getOrCreateVisitStart(db, 'u', 's', new Date('2026-11-04T14:30:00Z'));
  assert.equal(a, '2026-11-04T14:00:00.000Z');
  assert.equal(b, a);
});

test('clearVisitStart: la siguiente visita a la tienda cuenta de nuevo', async () => {
  const db = await fake();
  await getOrCreateVisitStart(db, 'u', 's', new Date('2026-11-04T14:00:00Z'));
  await clearVisitStart(db, 'u', 's', new Date('2026-11-04T14:20:00Z'));
  const next = await getOrCreateVisitStart(db, 'u', 's', new Date('2026-11-04T15:00:00Z'));
  assert.equal(next, '2026-11-04T15:00:00.000Z');
});

test('clearVisitStart solo borra la fila de ese usuario, tienda y dia', async () => {
  const db = await fake();
  const day = new Date(2026, 10, 4, 9, 0);
  await getOrCreateVisitStart(db, 'u', 's2', day);
  await getOrCreateVisitStart(db, 'u2', 's', day);
  await clearVisitStart(db, 'u', 's', day);
  assert.equal(await getOrCreateVisitStart(db, 'u', 's2', new Date(2026, 10, 4, 10, 0)), day.toISOString());
  assert.equal(await getOrCreateVisitStart(db, 'u2', 's', new Date(2026, 10, 4, 10, 0)), day.toISOString());
});

test('otro dia o tienda no reutiliza el inicio', async () => {
  const db = await fake();
  const first = new Date(2026, 10, 4, 9, 0);
  const a = await getOrCreateVisitStart(db, 'u', 's', first);
  const otherDay = await getOrCreateVisitStart(db, 'u', 's', new Date(2026, 10, 5, 9, 0));
  const otherStore = await getOrCreateVisitStart(db, 'u', 's2', new Date(2026, 10, 4, 9, 30));
  const otherUser = await getOrCreateVisitStart(db, 'u2', 's', new Date(2026, 10, 4, 9, 45));
  assert.equal(a, first.toISOString());
  assert.notEqual(otherDay, a);
  assert.notEqual(otherStore, a);
  assert.notEqual(otherUser, a);
});

test('el dia es el LOCAL del telefono: el borde lo pone la medianoche local, no la UTC', async () => {
  const db = await fake();
  const manana = new Date(2026, 10, 4, 0, 5);
  const noche = new Date(2026, 10, 4, 23, 55);
  const a = await getOrCreateVisitStart(db, 'u', 's', manana);
  assert.equal(await getOrCreateVisitStart(db, 'u', 's', noche), a, 'mismo dia local, mismo inicio');
  const madrugada = new Date(2026, 10, 5, 0, 5);
  assert.equal(await getOrCreateVisitStart(db, 'u', 's', madrugada), madrugada.toISOString());
});

const row = (over: Partial<VisitRow> = {}): VisitRow => ({
  visit_id: 'v1', session_id: 's1', store_id: 'st1', user_id: 'u1', check_in_time: '2026-11-04T14:30:00.000Z',
  lat: 10, lng: -66, photo_uri: null, observations: null, status: 'completed', anomaly_type: null,
  skip_reason: null, last_restock_date: null, synced: 0, supervisor_present_user_id: 'sup-1',
  started_at: '2026-11-04T14:00:00.000Z', ...over,
});

test('insertVisit guarda started_at en su columna, sin correr las demas', async () => {
  const db = await fake();
  await insertVisit(db, row());
  await insertVisit(db, row({ visit_id: 'v2', started_at: null }));
  const v1 = await db.getFirstAsync<any>(`SELECT * FROM visits WHERE visit_id='v1'`);
  assert.equal(v1.started_at, '2026-11-04T14:00:00.000Z');
  assert.equal(v1.supervisor_present_user_id, 'sup-1');
  assert.equal(v1.synced, 0);
  assert.equal(v1.photos_synced, 0);
  const v2 = await db.getFirstAsync<any>(`SELECT * FROM visits WHERE visit_id='v2'`);
  assert.equal(v2.started_at, null);
});

test('initSchema agrega started_at y las tablas nuevas a una BD vieja', async () => {
  const db = memoryDb();
  await db.execAsync(`CREATE TABLE visits (visit_id TEXT PRIMARY KEY, session_id TEXT, store_id TEXT NOT NULL, user_id TEXT NOT NULL, check_in_time TEXT NOT NULL, status TEXT NOT NULL, synced INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE location_pings (ping_id TEXT PRIMARY KEY, session_id TEXT, timestamp TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL);
    CREATE TABLE competition_reports (report_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL, synced INTEGER NOT NULL DEFAULT 0);
    INSERT INTO visits (visit_id, store_id, user_id, check_in_time, status) VALUES ('vieja','s','u','t','completed');`);
  await initSchema(db);
  const vieja = await db.getFirstAsync<any>(`SELECT started_at FROM visits WHERE visit_id='vieja'`);
  assert.equal(vieja.started_at, null);
  assert.deepEqual(await db.getAllAsync(`SELECT * FROM store_gps_captures`), []);
  assert.deepEqual(await db.getAllAsync(`SELECT * FROM visit_starts`), []);
});
