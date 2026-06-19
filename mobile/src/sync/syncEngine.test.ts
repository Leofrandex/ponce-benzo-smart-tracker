import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitUploadable } from './syncEngine';

test('splitUploadable: separa pings con y sin user_id', () => {
  const { ok, orphan } = splitUploadable([
    { ping_id: 'a', user_id: 'u1' },
    { ping_id: 'b', user_id: null },
    { ping_id: 'c', user_id: 'u1' },
  ]);
  assert.deepEqual(ok, ['a', 'c']);
  assert.deepEqual(orphan, ['b']);
});
