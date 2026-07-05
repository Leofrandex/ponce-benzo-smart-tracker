import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveSyncBanner } from './bannerState';

test('sincronizando sin cola → "Sincronizando…"', () => {
  const b = deriveSyncBanner({ status: 'syncing', pendingCount: 0 });
  assert.equal(b?.tone, 'syncing');
  assert.equal(b?.text, 'Sincronizando…');
});

test('sincronizando con cola → incluye el conteo', () => {
  const b = deriveSyncBanner({ status: 'syncing', pendingCount: 3 });
  assert.equal(b?.tone, 'syncing');
  assert.equal(b?.text, 'Sincronizando 3…');
});

test('offline con cola → "Sin conexión · N en cola"', () => {
  const b = deriveSyncBanner({ status: 'offline', pendingCount: 2 });
  assert.equal(b?.tone, 'offline');
  assert.equal(b?.text, 'Sin conexión · 2 en cola');
});

test('cola esperando con red (no offline, no syncing) → singular', () => {
  const b = deriveSyncBanner({ status: 'idle', pendingCount: 1 });
  assert.equal(b?.tone, 'pending');
  assert.equal(b?.text, '1 registro por subir');
});

test('cola esperando → plural', () => {
  const b = deriveSyncBanner({ status: 'synced', pendingCount: 5 });
  assert.equal(b?.tone, 'pending');
  assert.equal(b?.text, '5 registros por subir');
});

test('nada pendiente y sincronizado → oculto (null)', () => {
  assert.equal(deriveSyncBanner({ status: 'synced', pendingCount: 0 }), null);
});

test('nada pendiente e idle → oculto (null)', () => {
  assert.equal(deriveSyncBanner({ status: 'idle', pendingCount: 0 }), null);
});

test('offline sin cola → oculto (no hay nada que avisar)', () => {
  assert.equal(deriveSyncBanner({ status: 'offline', pendingCount: 0 }), null);
});
