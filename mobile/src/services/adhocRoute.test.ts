import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localDay, mergeSpecialStores, resolveStartRoute } from './adhocRoute';

test('localDay usa la fecha local del telefono, no la UTC', () => {
  const d = new Date(2026, 10, 5, 21, 17);
  assert.equal(localDay(d), '2026-11-05');
});

test('resolveStartRoute conserva la ruta cargada y no crea otra', async () => {
  let calls = 0;
  const id = await resolveStartRoute('r1', 'st1', async () => { calls++; return 'x'; });
  assert.equal(id, 'r1');
  assert.equal(calls, 0);
});

test('resolveStartRoute sin ruta cargada crea la especial con la primera tienda', async () => {
  const id = await resolveStartRoute(null, 'st1', async (store) => `esp-${store}`);
  assert.equal(id, 'esp-st1');
});

test('resolveStartRoute sin ruta y sin poder crearla devuelve null: no hay jornada sin ruta', async () => {
  assert.equal(await resolveStartRoute(null, 'st1', async () => { throw new Error('sin red'); }), null);
  assert.equal(await resolveStartRoute(null, undefined, async () => 'x'), null);
});

test('mergeSpecialStores agrega la tienda nueva al final', () => {
  assert.deepEqual(mergeSpecialStores(['a', 'b'], 'c'), ['a', 'b', 'c']);
});

test('mergeSpecialStores no duplica una tienda ya reportada hoy', () => {
  assert.deepEqual(mergeSpecialStores(['a', 'b'], 'b'), ['a', 'b']);
});

test('mergeSpecialStores arranca la lista cuando no habia ruta especial', () => {
  assert.deepEqual(mergeSpecialStores([], 'a'), ['a']);
});
