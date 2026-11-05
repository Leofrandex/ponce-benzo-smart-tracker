import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveSyncBanner } from './bannerState';

test('syncing sin cola → "Sincronizando…"', () => {
  const b = deriveSyncBanner({ status: 'syncing', records: 0, photos: 0 });
  assert.equal(b?.tone, 'syncing');
  assert.equal(b?.text, 'Sincronizando…');
});

test('syncing con cola → muestra el total (records + photos)', () => {
  const b = deriveSyncBanner({ status: 'syncing', records: 3, photos: 2 });
  assert.equal(b?.text, 'Sincronizando 5…');
});

test('offline con registros → "Sin conexión · N en cola"', () => {
  const b = deriveSyncBanner({ status: 'offline', records: 2, photos: 0 });
  assert.equal(b?.tone, 'offline');
  assert.equal(b?.text, 'Sin conexión · 2 en cola');
});

test('idle con 1 registro → singular', () => {
  const b = deriveSyncBanner({ status: 'idle', records: 1, photos: 0 });
  assert.equal(b?.tone, 'pending');
  assert.equal(b?.text, '1 registro por subir');
});

test('synced con registros pendientes → sigue mostrando la cola', () => {
  const b = deriveSyncBanner({ status: 'synced', records: 5, photos: 0 });
  assert.equal(b?.tone, 'pending');
  assert.equal(b?.text, '5 registros por subir');
});

test('sólo fotos pendientes → deja claro que los REGISTROS ya están arriba', () => {
  const b = deriveSyncBanner({ status: 'idle', records: 0, photos: 3 });
  assert.equal(b?.tone, 'pending');
  assert.equal(b?.text, 'Registros arriba ✓ · 3 fotos por subir');
});

test('offline con sólo fotos → registros arriba + fotos en cola', () => {
  const b = deriveSyncBanner({ status: 'offline', records: 0, photos: 1 });
  assert.equal(b?.tone, 'offline');
  assert.equal(b?.text, 'Registros arriba ✓ · 1 foto en cola');
});

test('synced y todo en cero → confirmación verde "Todo sincronizado"', () => {
  const b = deriveSyncBanner({ status: 'synced', records: 0, photos: 0 });
  assert.equal(b?.tone, 'synced');
  assert.equal(b?.text, 'Todo sincronizado');
});

test('idle sin nada → oculto (null)', () => {
  assert.equal(deriveSyncBanner({ status: 'idle', records: 0, photos: 0 }), null);
});

test('offline sin cola → oculto (no hay nada que avisar)', () => {
  assert.equal(deriveSyncBanner({ status: 'offline', records: 0, photos: 0 }), null);
});

test('error de servidor no dice Sin conexión (B1)', () => {
  const b = deriveSyncBanner({ status: 'error', records: 2, photos: 0 })!;
  assert.equal(b.tone, 'error');
  assert.equal(b.text, 'No se pudo subir · 2 en cola · se reintentará');
  assert.equal(b.icon, 'alert-circle-outline');
});

test('error con sólo fotos → dice cuántas y que se reintentará (B1)', () => {
  const plural = deriveSyncBanner({ status: 'error', records: 0, photos: 3 })!;
  assert.equal(plural.tone, 'error');
  assert.equal(plural.text, 'No se pudo subir · 3 fotos en cola · se reintentará');
  assert.equal(plural.icon, 'alert-circle-outline');
  assert.equal(deriveSyncBanner({ status: 'error', records: 0, photos: 1 })!.text, 'No se pudo subir · 1 foto en cola · se reintentará');
});

test('error sin cola → oculto, no dice Todo sincronizado', () => {
  assert.equal(deriveSyncBanner({ status: 'error', records: 0, photos: 0 }), null);
});

test('sin red sigue diciendo Sin conexión', () => {
  assert.equal(deriveSyncBanner({ status: 'offline', records: 2, photos: 0 })!.text, 'Sin conexión · 2 en cola');
});

test('Todo sincronizado solo con todo en cero (B4)', () => {
  assert.equal(deriveSyncBanner({ status: 'synced', records: 0, photos: 1 })!.tone, 'pending');
  assert.equal(deriveSyncBanner({ status: 'synced', records: 0, photos: 0 })!.text, 'Todo sincronizado');
});
