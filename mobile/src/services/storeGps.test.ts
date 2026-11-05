import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryDb } from '../testing/sqliteAdapter';
import { initSchema } from '../store/localStore';
import { queueGpsCapture, latestLocalCapture, effectiveStoreCoords } from './storeGps';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
async function fake() { const db = memoryDb(); await initSchema(db); return db; }
const input = (over = {}) => ({ storeId: 's1', userId: 'u1', lat: 10.5, lng: -66.9, nowIso: '2026-11-04T14:00:00.000Z', ...over });
// node:sqlite devuelve filas sin prototipo; deepEqual estricto las distingue de un objeto literal.
const latest = async (db: any, storeId: string) => ({ ...(await latestLocalCapture(db, storeId)) });

test('queueGpsCapture guarda en cola y genera id unico', async () => {
  const db = await fake();
  const a = await queueGpsCapture(db, input());
  const b = await queueGpsCapture(db, input());
  assert.notEqual(a, b);
  assert.match(a, UUID, 'el servidor pide uuid en p_capture_id');
  assert.match(b, UUID);
  const rows = await db.getAllAsync<any>(`SELECT * FROM store_gps_captures`);
  assert.equal(rows.length, 2);
  const fila = rows.find((r) => r.capture_id === a);
  assert.deepEqual(
    { store_id: fila.store_id, user_id: fila.user_id, lat: fila.lat, lng: fila.lng, captured_at: fila.captured_at, synced: fila.synced },
    { store_id: 's1', user_id: 'u1', lat: 10.5, lng: -66.9, captured_at: '2026-11-04T14:00:00.000Z', synced: 0 },
  );
});

test('queueGpsCapture lanza si SQLite no pudo guardar', async () => {
  const db = await fake();
  await db.execAsync(`DROP TABLE store_gps_captures`);
  await assert.rejects(queueGpsCapture(db, input()));
});

test('latestLocalCapture: la mas reciente de esa tienda, de cualquier cuenta del telefono', async () => {
  const db = await fake();
  assert.equal(await latestLocalCapture(db, 's1'), null);
  await queueGpsCapture(db, input({ lat: 1, lng: 1, nowIso: '2026-11-04T15:00:00.000Z' }));
  await queueGpsCapture(db, input({ lat: 2, lng: 2, nowIso: '2026-11-04T14:00:00.000Z' }));
  await queueGpsCapture(db, input({ storeId: 's2', lat: 3, lng: 3, nowIso: '2026-11-04T16:00:00.000Z' }));
  assert.deepEqual(await latest(db, 's1'), { lat: 1, lng: 1 });
  await queueGpsCapture(db, input({ userId: 'u2', lat: 4, lng: 4, nowIso: '2026-11-04T17:00:00.000Z' }));
  assert.deepEqual(await latest(db, 's1'), { lat: 4, lng: 4 });
});

test('latestLocalCapture: sigue contando una captura ya sincronizada', async () => {
  const db = await fake();
  const id = await queueGpsCapture(db, input({ lat: 7, lng: 8 }));
  await db.runAsync(`UPDATE store_gps_captures SET synced=1 WHERE capture_id=?`, id);
  assert.deepEqual(await latest(db, 's1'), { lat: 7, lng: 8 });
});

test('effectiveStoreCoords: la captura local gana sobre el parametro de navegacion', () => {
  const store = { master_lat: 1, master_lng: 2 };
  assert.deepEqual(effectiveStoreCoords(store, { lat: 3, lng: 4 }), { lat: 3, lng: 4 });
  assert.deepEqual(effectiveStoreCoords(store, null), { lat: 1, lng: 2 });
});

test('effectiveStoreCoords: tienda sin GPS y sin captura no tiene coordenadas', () => {
  assert.equal(effectiveStoreCoords({ master_lat: null, master_lng: null }, null), null);
  assert.equal(effectiveStoreCoords({ master_lat: 1, master_lng: null }, null), null);
  assert.deepEqual(effectiveStoreCoords({ master_lat: null, master_lng: null }, { lat: 0, lng: 0 }), { lat: 0, lng: 0 });
});
