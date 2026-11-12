import { test } from 'node:test';
import assert from 'node:assert/strict';
import { END_ROUTE_CONFIRM } from './confirmEndRoute';

test('textos de la confirmacion', () => {
  assert.deepEqual(END_ROUTE_CONFIRM, {
    title: '¿Seguro que quieres finalizar la ruta?',
    body: 'Una vez finalizada no puedes volver a reportar visitas el día de hoy.',
    cancel: 'No',
    confirm: 'Sí',
  });
});
