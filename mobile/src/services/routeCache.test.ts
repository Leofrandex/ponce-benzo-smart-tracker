import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRouteLoad, parseSnapshot, serializeSnapshot, type RouteSnapshot } from './routeCache';
import type { Store } from '../types';

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
