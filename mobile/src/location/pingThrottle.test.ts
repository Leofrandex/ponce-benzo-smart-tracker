import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldEmitPing } from './pingThrottle';

test('emite si nunca hubo ping', () => assert.equal(shouldEmitPing(null, 1000), true));
test('no emite antes de 30s', () => assert.equal(shouldEmitPing(1000, 1000 + 12_000), false));
test('emite pasados 30s', () => assert.equal(shouldEmitPing(1000, 1000 + 30_000), true));
