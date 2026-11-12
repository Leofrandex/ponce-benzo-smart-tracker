import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearbyStores, isWeakAccuracy, canSaveProposal, DUPLICATE_RADIUS_M } from './storeProposals';
import { haversineMeters } from '../utils/geo';

const st = (id: string, lat: number, lng: number) => ({ store_id: id, master_lat: lat, master_lng: lng });

test('haversineMeters: ~111 m por milésima de grado de latitud', () => {
  const d = haversineMeters(10.49, -66.85, 10.491, -66.85);
  assert.ok(d > 105 && d < 117, `d=${d}`);
});

test('nearbyStores: devuelve solo las de menos de 100 m, ordenadas', () => {
  const out = nearbyStores([st('lejos', 10.5, -66.85), st('b', 10.4905, -66.85), st('a', 10.4901, -66.85)], 10.49, -66.85);
  assert.deepEqual(out.map((s) => s.store_id), ['a', 'b']);
  assert.ok(out[0].distance_m < out[1].distance_m);
  assert.ok(out.every((s) => s.distance_m <= DUPLICATE_RADIUS_M));
});

test('nearbyStores: sin catálogo (sin conexión) devuelve []', () => {
  assert.deepEqual(nearbyStores([], 10.49, -66.85), []);
});

test('isWeakAccuracy: > 50 m o desconocida es débil', () => {
  assert.equal(isWeakAccuracy(12), false);
  assert.equal(isWeakAccuracy(50), false);
  assert.equal(isWeakAccuracy(51), true);
  assert.equal(isWeakAccuracy(null), true);
});

test('canSaveProposal: exige nombre no vacío y ubicación', () => {
  assert.equal(canSaveProposal({ name: 'Farmacia X', lat: 10, lng: -66 }), true);
  assert.equal(canSaveProposal({ name: '   ', lat: 10, lng: -66 }), false);
  assert.equal(canSaveProposal({ name: 'Farmacia X', lat: null, lng: null }), false);
});

test('nearbyStores: ignora las sucursales sin GPS', () => {
  const out = nearbyStores([{ store_id: 'sin', master_lat: null, master_lng: null }, st('a', 10.4901, -66.85)], 10.49, -66.85);
  assert.deepEqual(out.map((s) => s.store_id), ['a']);
});
