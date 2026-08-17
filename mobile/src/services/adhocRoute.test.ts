import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeSpecialStores } from './adhocRoute';

test('mergeSpecialStores agrega la tienda nueva al final', () => {
  assert.deepEqual(mergeSpecialStores(['a', 'b'], 'c'), ['a', 'b', 'c']);
});

test('mergeSpecialStores no duplica una tienda ya reportada hoy', () => {
  assert.deepEqual(mergeSpecialStores(['a', 'b'], 'b'), ['a', 'b']);
});

test('mergeSpecialStores arranca la lista cuando no habia ruta especial', () => {
  assert.deepEqual(mergeSpecialStores([], 'a'), ['a']);
});
