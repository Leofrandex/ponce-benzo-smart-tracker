import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMigrations } from './localStore';

test('buildMigrations: agrega columnas faltantes y omite las presentes', () => {
  const existing = {
    visits: new Set(['visit_id', 'store_id']),
    location_pings: new Set(['ping_id', 'session_id', 'timestamp', 'lat', 'lng']),
    competition_reports: new Set(['report_id']),
  };
  const stmts = buildMigrations(existing);
  assert.ok(stmts.some((s) => s.includes('ALTER TABLE visits ADD COLUMN anomaly_type')));
  assert.ok(stmts.some((s) => s.includes('ALTER TABLE visits ADD COLUMN photos_synced INTEGER NOT NULL DEFAULT 1')));
  assert.ok(stmts.some((s) => s.includes('ALTER TABLE location_pings ADD COLUMN user_id')));
  assert.ok(stmts.some((s) => s.includes('ALTER TABLE location_pings ADD COLUMN synced')));
  assert.ok(stmts.some((s) => s.includes('ALTER TABLE competition_reports ADD COLUMN visit_id')));
  assert.ok(stmts.some((s) => s.includes('ALTER TABLE competition_reports ADD COLUMN photos_synced')));
  assert.ok(!stmts.some((s) => s.includes('ALTER TABLE visits ADD COLUMN visit_id')));
});

test('buildMigrations: sin faltantes devuelve []', () => {
  const full = {
    visits: new Set(['anomaly_type', 'skip_reason', 'last_restock_date', 'photos_synced']),
    location_pings: new Set(['user_id', 'synced']),
    competition_reports: new Set(['visit_id', 'photos_synced']),
  };
  assert.deepEqual(buildMigrations(full), []);
});

test('buildMigrations: existing vacío emite TODAS las columnas opcionales', () => {
  const stmts = buildMigrations({});
  assert.ok(stmts.some((s) => s.includes('ALTER TABLE visits ADD COLUMN anomaly_type')));
  assert.ok(stmts.some((s) => s.includes('ALTER TABLE visits ADD COLUMN skip_reason')));
  assert.ok(stmts.some((s) => s.includes('ALTER TABLE visits ADD COLUMN last_restock_date')));
  assert.ok(stmts.some((s) => s.includes('ALTER TABLE competition_reports ADD COLUMN visit_id')));
  assert.ok(stmts.some((s) => s.includes('ALTER TABLE location_pings ADD COLUMN user_id')));
  assert.ok(stmts.some((s) => s.includes('ALTER TABLE location_pings ADD COLUMN synced')));
});
