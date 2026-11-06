import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveUpdateBanner } from './updateBannerState';

test('sin descarga ni actualización pendiente no muestra nada', () => {
  assert.equal(deriveUpdateBanner({ isDownloading: false, isUpdatePending: false }), null);
});

test('descargando muestra el porcentaje y la barra', () => {
  const b = deriveUpdateBanner({ isDownloading: true, isUpdatePending: false, downloadProgress: 0.456 });
  assert.equal(b?.kind, 'downloading');
  assert.equal(b?.text, 'Descargando nueva versión… 46%');
  assert.equal(b?.progress, 0.456);
});

test('descargando sin progreso conocido no inventa un porcentaje', () => {
  const b = deriveUpdateBanner({ isDownloading: true, isUpdatePending: false });
  assert.equal(b?.text, 'Descargando nueva versión…');
  assert.equal(b?.progress, null);
});

test('un progreso fuera de rango se acota', () => {
  assert.equal(deriveUpdateBanner({ isDownloading: true, isUpdatePending: false, downloadProgress: 1.4 })?.progress, 1);
  assert.equal(deriveUpdateBanner({ isDownloading: true, isUpdatePending: false, downloadProgress: -1 })?.progress, 0);
});

test('terminada la descarga pide cerrar y abrir la app', () => {
  const b = deriveUpdateBanner({ isDownloading: false, isUpdatePending: true });
  assert.equal(b?.kind, 'ready');
  assert.equal(b?.text, 'App lista para actualizar. Por favor, ciérrala y ábrela de nuevo.');
  assert.equal(b?.progress, null);
});

test('si ya hay una lista y se descarga otra más nueva, manda la descarga', () => {
  assert.equal(deriveUpdateBanner({ isDownloading: true, isUpdatePending: true, downloadProgress: 0.1 })?.kind, 'downloading');
});
