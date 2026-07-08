import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withTimeout } from './withTimeout';

const delay = <T>(ms: number, value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

test('devuelve el valor si la promesa resuelve antes del timeout', async () => {
  const r = await withTimeout(delay(10, 'ok'), 100, 'fallback');
  assert.equal(r, 'ok');
});

test('devuelve el fallback si la promesa tarda más que el timeout', async () => {
  const r = await withTimeout(delay(100, 'lento'), 20, 'fallback');
  assert.equal(r, 'fallback');
});

test('devuelve el fallback si la promesa rechaza', async () => {
  const r = await withTimeout(Promise.reject(new Error('boom')), 100, 'fallback');
  assert.equal(r, 'fallback');
});

test('funciona con fallback null (patrón del fix GPS)', async () => {
  const r = await withTimeout<{ x: number } | null>(delay(100, { x: 1 }), 20, null);
  assert.equal(r, null);
});
