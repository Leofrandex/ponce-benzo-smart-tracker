import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTodayState, selectStaleOpen, localDayOf } from './sessionState';

const U = 'u1';
const now = '2026-06-19T15:00:00.000Z';
const VET = 240; // Venezuela UTC-4 (Date.getTimezoneOffset())
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

// ── Regresión del bug de las 8 PM (día UTC vs día local) ─────────────────────
// A las 20:30 de Venezuela ya es el día siguiente en UTC. Con el cálculo viejo
// (día UTC) la sesión de la mañana "cambiaba de día": se autocerraba como stale
// y las visitas desaparecían de la ruta.

test('localDayOf: 20:30 VET sigue siendo el mismo día local', () => {
  // 2026-07-16T00:30Z === 2026-07-15 20:30 en Venezuela
  assert.equal(localDayOf('2026-07-16T00:30:00.000Z', VET), '2026-07-15');
  assert.equal(localDayOf('2026-07-15T11:44:03.455Z', VET), '2026-07-15'); // 07:44 VET
});

test('REGRESIÓN 8PM: sesión de la mañana sigue ACTIVE a las 20:30 hora local', () => {
  const nowNight = '2026-07-16T00:30:00.000Z'; // 20:30 VET del día 15
  const r = resolveTodayState([mk('a', '2026-07-15T11:44:03.455Z', null)], U, nowNight, VET);
  assert.equal(r.state, 'ACTIVE');
});

test('REGRESIÓN 8PM: la sesión de la mañana NO es stale a las 20:30 hora local', () => {
  const nowNight = '2026-07-16T00:30:00.000Z';
  const stale = selectStaleOpen([mk('a', '2026-07-15T11:44:03.455Z', null)], U, nowNight, VET);
  assert.deepEqual(stale, []);
});

test('el día local SÍ corta a medianoche local (04:00Z = 00:00 VET)', () => {
  const r = resolveTodayState([mk('a', '2026-07-15T11:44:00Z', null)], U, '2026-07-16T04:30:00Z', VET);
  assert.equal(r.state, 'NONE'); // ya es 16-jul en Venezuela → la sesión del 15 no es "hoy"
});
