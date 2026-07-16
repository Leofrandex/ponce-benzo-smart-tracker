import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localDayRangeUtc } from './db';

// localDayRangeUtc usa la zona horaria del runtime (como en el dispositivo), así
// que los asserts son invariantes, no valores fijos.

test('localDayRangeUtc: el rango dura exactamente 24h', () => {
  const { startIso, endIso } = localDayRangeUtc(new Date('2026-07-15T23:30:00Z'));
  assert.equal(Date.parse(endIso) - Date.parse(startIso), 86_400_000);
});

test('localDayRangeUtc: "ahora" siempre cae dentro de su propio rango', () => {
  const now = new Date();
  const { startIso, endIso } = localDayRangeUtc(now);
  const iso = now.toISOString();
  assert.ok(iso >= startIso && iso < endIso, `${iso} debería estar en [${startIso}, ${endIso})`);
});

test('localDayRangeUtc: dos horas del mismo día local comparten rango (mañana vs noche)', () => {
  // 09:00 y 21:00 hora LOCAL del mismo día — con el filtro UTC viejo, después de
  // las 8PM en Venezuela estos dos momentos caían en "días" distintos.
  const morning = new Date(2026, 6, 15, 9, 0, 0);
  const night = new Date(2026, 6, 15, 21, 0, 0);
  assert.deepEqual(localDayRangeUtc(morning), localDayRangeUtc(night));
});

test('localDayRangeUtc: medianoche local corta el rango', () => {
  const beforeMidnight = new Date(2026, 6, 15, 23, 59, 0);
  const afterMidnight = new Date(2026, 6, 16, 0, 1, 0);
  assert.notDeepEqual(localDayRangeUtc(beforeMidnight), localDayRangeUtc(afterMidnight));
});
