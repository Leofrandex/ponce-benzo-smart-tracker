import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatLogLine } from './log';

test('formatLogLine: incluye hora, nivel, evento y detalle', () => {
  const line = formatLogLine({ ts: '2026-06-19T13:37:31.000Z', level: 'warn', event: 'ping_skip', detail: 'throttle 12s' });
  assert.match(line, /WARN/);
  assert.match(line, /ping_skip/);
  assert.match(line, /throttle 12s/);
});

test('formatLogLine: sin detalle no rompe', () => {
  const line = formatLogLine({ ts: '2026-06-19T13:37:31.000Z', level: 'info', event: 'session_start', detail: null });
  assert.match(line, /session_start/);
});
