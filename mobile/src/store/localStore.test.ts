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
    visits: new Set(['anomaly_type', 'skip_reason', 'last_restock_date', 'photos_synced', 'supervisor_present_user_id', 'photo_attempts', 'photo_next_try', 'photos_done', 'started_at']),
    location_pings: new Set(['user_id', 'synced']),
    competition_reports: new Set(['visit_id', 'photos_synced', 'photo_attempts', 'photo_next_try', 'photos_done']),
    sessions: new Set(['app_version', 'ota_update_id']),
    store_proposals: new Set(['photo_attempts', 'photo_next_try', 'photos_done']),
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

test('buildMigrations: columnas de reintento de fotos dejan elegibles las filas existentes', () => {
  const stmts = buildMigrations({});
  for (const t of ['visits', 'competition_reports', 'store_proposals']) {
    assert.ok(stmts.includes(`ALTER TABLE ${t} ADD COLUMN photo_attempts INTEGER NOT NULL DEFAULT 0`));
    assert.ok(stmts.includes(`ALTER TABLE ${t} ADD COLUMN photo_next_try TEXT`));
    assert.ok(stmts.includes(`ALTER TABLE ${t} ADD COLUMN photos_done INTEGER NOT NULL DEFAULT 0`));
  }
});

test("buildMigrations: agrega sessions.app_version si falta y no la repite", () => {
  const faltan = buildMigrations({ sessions: new Set(["session_id"]) });
  assert.ok(faltan.includes("ALTER TABLE sessions ADD COLUMN app_version TEXT"));
  assert.ok(faltan.includes("ALTER TABLE sessions ADD COLUMN ota_update_id TEXT"));
  const ya = buildMigrations({ sessions: new Set(["session_id", "app_version", "ota_update_id"]) });
  assert.ok(!ya.some((s) => s.startsWith("ALTER TABLE sessions")));
});
