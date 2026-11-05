import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickRoute } from './pickRoute';
import type { Route } from '../types';

const mk = (id: string, date: string): Route => ({
  route_id: id, user_id: 'u', route_date: date, store_ids: [], created_at: '', is_special: false,
});

test('pickRoute elige la ruta de hoy cuando existe', () => {
  const r = pickRoute([mk('a', '2026-06-09'), mk('b', '2026-06-08')], '2026-06-08');
  assert.equal(r?.route_id, 'b');
});

test('pickRoute devuelve null cuando no hay ruta de hoy (sin fallback)', () => {
  const r = pickRoute([mk('a', '2026-06-09'), mk('b', '2026-06-11')], '2026-06-15');
  assert.equal(r, null);
});

test('pickRoute devuelve null sin rutas', () => {
  assert.equal(pickRoute([], '2026-06-08'), null);
});

test('pickRoute prefiere la ruta normal sobre la especial del mismo dia, en cualquier orden', () => {
  const normal = mk('normal', '2026-06-08');
  const especial = { ...mk('especial', '2026-06-08'), is_special: true };
  assert.equal(pickRoute([especial, normal], '2026-06-08')?.route_id, 'normal');
  assert.equal(pickRoute([normal, especial], '2026-06-08')?.route_id, 'normal');
});

test('pickRoute usa la ruta especial si es la unica de hoy', () => {
  const especial = { ...mk('especial', '2026-06-08'), is_special: true };
  const otroDia = mk('normal-ayer', '2026-06-07');
  assert.equal(pickRoute([otroDia, especial], '2026-06-08')?.route_id, 'especial');
});
