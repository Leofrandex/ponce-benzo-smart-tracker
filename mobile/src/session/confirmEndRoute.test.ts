import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmEndRouteArgs } from './confirmEndRoute';

test('textos y estilos de la confirmacion', () => {
  const [title, body, buttons] = confirmEndRouteArgs(() => {});
  assert.equal(title, '¿Seguro que quieres finalizar la ruta?');
  assert.equal(body, 'Una vez finalizada no puedes volver a reportar visitas el día de hoy.');
  assert.deepEqual(buttons.map((b) => [b.text, b.style]), [['No', 'cancel'], ['Sí', 'destructive']]);
});

test('solo "Sí" finaliza la ruta', () => {
  let ended = 0;
  const [, , buttons, options] = confirmEndRouteArgs(() => { ended++; });
  buttons[0].onPress?.();
  assert.equal(ended, 0);
  buttons[1].onPress?.();
  assert.equal(ended, 1);
  // Atras o tocar afuera cierran el aviso sin llamar a nada.
  assert.equal(options.cancelable, true);
  assert.equal(options.onDismiss, undefined);
});
