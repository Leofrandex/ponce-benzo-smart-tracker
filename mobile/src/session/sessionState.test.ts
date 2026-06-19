import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTodayState, selectStaleOpen } from './sessionState';

const U = 'u1';
const now = '2026-06-19T15:00:00.000Z';
const mk = (id: string, start: string, end: string | null) =>
  ({ session_id: id, user_id: U, session_start: start, session_end: end });

test('NONE cuando no hay sesión de hoy', () => {
  const r = resolveTodayState([mk('a', '2026-06-18T10:00:00Z', null)], U, now);
  assert.equal(r.state, 'NONE');
});

test('ACTIVE cuando la sesión de hoy está abierta', () => {
  const r = resolveTodayState([mk('a', '2026-06-19T09:00:00Z', null)], U, now);
  assert.equal(r.state, 'ACTIVE');
  assert.equal(r.session?.session_id, 'a');
});

test('ENDED cuando la sesión de hoy está cerrada', () => {
  const r = resolveTodayState([mk('a', '2026-06-19T09:00:00Z', '2026-06-19T12:00:00Z')], U, now);
  assert.equal(r.state, 'ENDED');
});

test('toma la sesión de hoy más reciente', () => {
  const r = resolveTodayState([
    mk('a', '2026-06-19T08:00:00Z', '2026-06-19T09:00:00Z'),
    mk('b', '2026-06-19T10:00:00Z', null),
  ], U, now);
  assert.equal(r.state, 'ACTIVE');
  assert.equal(r.session?.session_id, 'b');
});

test('ignora sesiones de otro usuario', () => {
  const r = resolveTodayState([{ session_id: 'x', user_id: 'otro', session_start: '2026-06-19T09:00:00Z', session_end: null }], U, now);
  assert.equal(r.state, 'NONE');
});

test('selectStaleOpen: sólo abiertas de días anteriores', () => {
  const stale = selectStaleOpen([
    mk('viejo', '2026-06-18T09:00:00Z', null),
    mk('hoy', '2026-06-19T09:00:00Z', null),
    mk('cerrado', '2026-06-17T09:00:00Z', '2026-06-17T10:00:00Z'),
  ], U, now);
  assert.deepEqual(stale.map((s) => s.session_id), ['viejo']);
});
