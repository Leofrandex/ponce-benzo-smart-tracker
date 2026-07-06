import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveProfileLoad, parseUserProfile, serializeUserProfile } from './userCache';
import type { User } from '../types';

const user: User = {
  id: 'u1',
  full_name: 'Elvis Rondón',
  email: 'elvis@ponce-benzo.com',
  role: 'merchandiser',
  active: true,
  created_at: '2026-01-01T00:00:00.000Z',
  supervisor_id: 's1',
};

test('resolveProfileLoad: online ok → usa el perfil de red', () => {
  const r = resolveProfileLoad({ ok: true, user }, null);
  assert.equal(r.source, 'online');
  assert.deepEqual(r.user, user);
});

test('resolveProfileLoad: offline con caché → restaura el perfil local (NO desloguea)', () => {
  const r = resolveProfileLoad({ ok: false }, user);
  assert.equal(r.source, 'cache');
  assert.deepEqual(r.user, user);
});

test('resolveProfileLoad: offline sin caché → sin usuario (primer login debe ser online)', () => {
  const r = resolveProfileLoad({ ok: false }, null);
  assert.equal(r.source, 'none');
  assert.equal(r.user, null);
});

test('serialize→parse hace round-trip fiel', () => {
  assert.deepEqual(parseUserProfile(serializeUserProfile(user)), user);
});

test('parseUserProfile: null devuelve null', () => {
  assert.equal(parseUserProfile(null), null);
});

test('parseUserProfile: JSON corrupto devuelve null (no lanza)', () => {
  assert.equal(parseUserProfile('{roto'), null);
});
