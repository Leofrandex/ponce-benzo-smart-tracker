import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMigrations } from './localStore';

test('buildMigrations: agrega columnas faltantes y omite las presentes', () => {
  const existing = {
    visits: new Set(['visit_id', 'store_id']),
    location_pings: new Set(['ping_id', 'session_id', 'timestamp', 'lat', 'lng']),
  };
  const stmts = buildMigrations(existing);
  assert.ok(stmts.some((s) => s.includes('ALTER TABLE location_pings ADD COLUMN user_id')));
  assert.ok(stmts.some((s) => s.includes('ALTER TABLE location_pings ADD COLUMN synced')));
  assert.ok(!stmts.some((s) => s.includes('ADD COLUMN visit_id')));
});

test('buildMigrations: sin faltantes devuelve []', () => {
  const full = {
    visits: new Set(['anomaly_type', 'skip_reason', 'last_restock_date']),
    location_pings: new Set(['user_id', 'synced']),
    competition_reports: new Set(['visit_id']),
  };
  assert.deepEqual(buildMigrations(full), []);
});
