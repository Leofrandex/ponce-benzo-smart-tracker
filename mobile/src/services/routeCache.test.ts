import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRouteLoad, parseSnapshot, serializeSnapshot, mergeRecordedStatuses, type RouteSnapshot, type RecordedVisit } from './routeCache';
import type { Store, RouteStoreItem } from '../types';

function makeStore(id: string): Store {
  return {
    store_id: id,
    name: `Tienda ${id}`,
    address: null,
    master_lat: 10.5,
    master_lng: -66.9,
    active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    contact_name: null,
    contact_phone: null,
    contact_email: null,
    estado: null,
    municipio: null,
    urbanizacion: null,
    business_channel: null,
    classification: null,
  };
}

const snapshot: RouteSnapshot = {
  route_id: 'r1',
  route_date: '2026-07-05',
  cached_at: '2026-07-05T08:00:00.000Z',
  stores: [makeStore('s1'), makeStore('s2')],
};

test('resolveRouteLoad: online ok → usa online y señala cachear', () => {
  const r = resolveRouteLoad(
    { ok: true, route_id: 'r1', route_date: '2026-07-05', stores: [makeStore('s1')] },
    null,
  );
  assert.equal(r.source, 'online');
  assert.equal(r.route_id, 'r1');
  assert.equal(r.route_date, '2026-07-05');
  assert.equal(r.stores.length, 1);
});

test('resolveRouteLoad: offline con caché → usa caché', () => {
  const r = resolveRouteLoad({ ok: false }, snapshot);
  assert.equal(r.source, 'cache');
  assert.equal(r.route_id, 'r1');
  assert.equal(r.route_date, '2026-07-05');
  assert.equal(r.stores.length, 2);
});

test('resolveRouteLoad: offline sin caché → error', () => {
  const r = resolveRouteLoad({ ok: false }, null);
  assert.equal(r.source, 'error');
});

test('serialize→parse hace round-trip fiel', () => {
  const parsed = parseSnapshot(serializeSnapshot(snapshot));
  assert.deepEqual(parsed, snapshot);
});

test('parseSnapshot: null devuelve null', () => {
  assert.equal(parseSnapshot(null), null);
});

test('parseSnapshot: JSON corrupto devuelve null (no lanza)', () => {
  assert.equal(parseSnapshot('{no es json'), null);
});

// ── mergeRecordedStatuses: reproyecta el estado de la ruta desde SQLite ──────────

function makeItem(id: string): RouteStoreItem {
  return { store: makeStore(id), order: 1, status: 'pending' };
}

test('mergeRecordedStatuses: sin visitas → todo queda pending', () => {
  const items = [makeItem('s1'), makeItem('s2')];
  const merged = mergeRecordedStatuses(items, []);
  assert.deepEqual(merged.map((i) => i.status), ['pending', 'pending']);
});

test('mergeRecordedStatuses: restaura status de cada tienda visitada (el bug del piloto)', () => {
  const items = [makeItem('s1'), makeItem('s2'), makeItem('s3')];
  const visits: RecordedVisit[] = [
    { store_id: 's1', status: 'completed', check_in_time: '2026-07-09T12:00:00.000Z' },
    { store_id: 's2', status: 'anomaly', check_in_time: '2026-07-09T13:00:00.000Z' },
  ];
  const merged = mergeRecordedStatuses(items, visits);
  assert.deepEqual(merged.map((i) => i.status), ['completed', 'anomaly', 'pending']);
});

test('mergeRecordedStatuses: con varias visitas de una tienda gana la más reciente', () => {
  const items = [makeItem('s1')];
  const visits: RecordedVisit[] = [
    { store_id: 's1', status: 'skipped', check_in_time: '2026-07-09T10:00:00.000Z' },
    { store_id: 's1', status: 'completed', check_in_time: '2026-07-09T15:00:00.000Z' },
  ];
  const merged = mergeRecordedStatuses(items, visits);
  assert.equal(merged[0].status, 'completed');
});

test('mergeRecordedStatuses: status desconocido se ignora (no rompe el pending)', () => {
  const items = [makeItem('s1')];
  const merged = mergeRecordedStatuses(items, [
    { store_id: 's1', status: 'garbage', check_in_time: '2026-07-09T10:00:00.000Z' },
  ]);
  assert.equal(merged[0].status, 'pending');
});

test('mergeRecordedStatuses: no muta el arreglo de entrada', () => {
  const items = [makeItem('s1')];
  mergeRecordedStatuses(items, [
    { store_id: 's1', status: 'completed', check_in_time: '2026-07-09T10:00:00.000Z' },
  ]);
  assert.equal(items[0].status, 'pending');
});
