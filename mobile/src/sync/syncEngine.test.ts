import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitUploadable, photoCount, flush, pendingCounts } from './syncEngine';

test('splitUploadable: separa pings con y sin user_id', () => {
  const { ok, orphan } = splitUploadable([
    { ping_id: 'a', user_id: 'u1' },
    { ping_id: 'b', user_id: null },
    { ping_id: 'c', user_id: 'u1' },
  ]);
  assert.deepEqual(ok, ['a', 'c']);
  assert.deepEqual(orphan, ['b']);
});

test('photoCount: JSON array, null y basura', () => {
  assert.equal(photoCount('["file://a","file://b"]'), 2);
  assert.equal(photoCount('[]'), 0);
  assert.equal(photoCount(null), 0);
  assert.equal(photoCount('no-es-json'), 0);
});

// ── Arnés en memoria: SQLite y Supabase falsos ────────────────────────────────
// Simula las 5 tablas locales con arrays y un cliente Supabase que puede fallar
// por tabla/bucket. Suficiente para probar el ORDEN y la INDEPENDENCIA de fases.

type Row = Record<string, any>;

function fakeDb(tables: Record<string, Row[]>) {
  const match = (sql: string): Row[] => {
    if (sql.includes('FROM sessions')) return tables.sessions.filter((r) => r.synced === 0);
    // OJO: chequear photos_synced primero — 'photos_synced = 0' contiene 'synced = 0'.
    if (sql.includes('FROM visits') && sql.includes('photos_synced = 0')) return tables.visits.filter((r) => r.synced === 1 && r.photos_synced === 0);
    if (sql.includes('FROM visits') && sql.includes('synced = 0')) return tables.visits.filter((r) => r.synced === 0);
    if (sql.includes('FROM competition_reports') && sql.includes('photos_synced = 0')) return tables.competition_reports.filter((r) => r.synced === 1 && r.photos_synced === 0);
    if (sql.includes('FROM competition_reports') && sql.includes('synced = 0')) return tables.competition_reports.filter((r) => r.synced === 0);
    if (sql.includes('FROM location_pings')) return tables.location_pings.filter((r) => r.synced === 0);
    return [];
  };
  return {
    getAllAsync: async (sql: string) => match(sql),
    getFirstAsync: async (sql: string) => {
      if (sql.includes('AS records')) {
        return {
          records:
            tables.sessions.filter((r) => r.synced === 0).length +
            tables.visits.filter((r) => r.synced === 0).length +
            tables.competition_reports.filter((r) => r.synced === 0).length,
          photos:
            tables.visits.filter((r) => r.synced === 1 && r.photos_synced === 0).length +
            tables.competition_reports.filter((r) => r.synced === 1 && r.photos_synced === 0).length,
          pings: tables.location_pings.filter((r) => r.synced === 0).length,
        };
      }
      return null;
    },
    runAsync: async (sql: string, ...args: any[]) => {
      const id = args[args.length - 1];
      const find = (rows: Row[], key: string) => rows.find((r) => r[key] === id);
      if (sql.includes('UPDATE sessions')) { const r = find(tables.sessions, 'session_id'); if (r) r.synced = 1; }
      if (sql.includes('UPDATE visits SET synced=1')) { const r = find(tables.visits, 'visit_id'); if (r) { r.synced = 1; r.photos_synced = args[0]; } }
      if (sql.includes('UPDATE visits SET photos_synced=1')) { const r = find(tables.visits, 'visit_id'); if (r) r.photos_synced = 1; }
      if (sql.includes('UPDATE competition_reports SET synced=1')) { const r = find(tables.competition_reports, 'report_id'); if (r) { r.synced = 1; r.photos_synced = args[0]; } }
      if (sql.includes('UPDATE competition_reports SET photos_synced=1')) { const r = find(tables.competition_reports, 'report_id'); if (r) r.photos_synced = 1; }
      if (sql.includes('UPDATE location_pings')) { const r = find(tables.location_pings, 'ping_id'); if (r) r.synced = 1; }
    },
  } as any;
}

function fakeSupabase(opts: { failTables?: string[]; failStorage?: boolean } = {}) {
  const calls: string[] = [];
  const result = (table: string) =>
    opts.failTables?.includes(table)
      ? Promise.resolve({ error: { message: `red caída (${table})` } })
      : Promise.resolve({ error: null });
  return {
    calls,
    from: (table: string) => ({
      upsert: (_payload: any, _opts: any) => { calls.push(`upsert:${table}`); return result(table); },
      update: (_payload: any) => ({ eq: () => { calls.push(`update:${table}`); return result(table); } }),
    }),
    storage: {
      from: (_bucket: string) => ({
        upload: () => {
          calls.push('storage:upload');
          return opts.failStorage
            ? Promise.resolve({ error: { message: 'foto no subió' } })
            : Promise.resolve({ error: null });
        },
      }),
    },
  } as any;
}

const visit = (id: string, over: Row = {}): Row => ({
  visit_id: id, session_id: 's1', store_id: 'st1', user_id: 'u1', check_in_time: '2026-07-15T14:00:00.000Z',
  lat: 10, lng: -66, photo_uri: null, observations: null, status: 'completed',
  anomaly_type: null, skip_reason: null, last_restock_date: null, synced: 0, photos_synced: 0, ...over,
});

const baseTables = () => ({ sessions: [] as Row[], visits: [] as Row[], competition_reports: [] as Row[], location_pings: [] as Row[] });

test('flush: visita sin fotos sube y queda synced + photos_synced', async () => {
  const tables = baseTables();
  tables.visits.push(visit('v1'));
  const db = fakeDb(tables);
  const r = await flush(db, fakeSupabase());
  assert.equal(r.failed, 0);
  assert.equal(tables.visits[0].synced, 1);
  assert.equal(tables.visits[0].photos_synced, 1); // sin fotos → nada pendiente
});

test('REGRESIÓN: el registro sube AUNQUE las fotos fallen (fotos no bloquean visitas)', async () => {
  const tables = baseTables();
  tables.visits.push(visit('v1', { photo_uri: '["file://inexistente.jpg"]' }));
  const db = fakeDb(tables);
  // fetch() de la foto local falla en node (URI inexistente) → la fase de fotos falla.
  const r = await flush(db, fakeSupabase());
  assert.equal(tables.visits[0].synced, 1, 'el REGISTRO debe estar arriba');
  assert.equal(tables.visits[0].photos_synced, 0, 'las fotos quedan pendientes de reintento');
  assert.ok(r.failed >= 1, 'el fallo de fotos se cuenta (banner → offline/pendiente)');
  // El conteo refleja: 0 registros en cola, 1 foto pendiente.
  const counts = await pendingCounts(db);
  assert.equal(counts.records, 0);
  assert.equal(counts.photos, 1);
});

test('flush: fallo de UNA tabla no frena las demás (visita cae, ping sube)', async () => {
  const tables = baseTables();
  tables.visits.push(visit('v1'));
  tables.location_pings.push({ ping_id: 'p1', session_id: 's1', user_id: 'u1', timestamp: 't', lat: 1, lng: 2, synced: 0 });
  const db = fakeDb(tables);
  const r = await flush(db, fakeSupabase({ failTables: ['visits'] }));
  assert.equal(tables.visits[0].synced, 0, 'la visita queda en cola para reintento');
  assert.equal(tables.location_pings[0].synced, 1, 'el ping subió igual');
  assert.equal(r.failed, 1);
});

test('flush: fallos de pings SÍ cuentan como failed (antes se tragaban)', async () => {
  const tables = baseTables();
  tables.location_pings.push({ ping_id: 'p1', session_id: 's1', user_id: 'u1', timestamp: 't', lat: 1, lng: 2, synced: 0 });
  const db = fakeDb(tables);
  const r = await flush(db, fakeSupabase({ failTables: ['location_pings'] }));
  assert.equal(r.failed, 1);
});

test('flush: registros suben ANTES que pings y fotos (orden por valor)', async () => {
  const tables = baseTables();
  tables.visits.push(visit('v1'));
  tables.location_pings.push({ ping_id: 'p1', session_id: 's1', user_id: 'u1', timestamp: 't', lat: 1, lng: 2, synced: 0 });
  const db = fakeDb(tables);
  const supa = fakeSupabase();
  await flush(db, supa);
  const iVisit = supa.calls.indexOf('upsert:visits');
  const iPing = supa.calls.indexOf('upsert:location_pings');
  assert.ok(iVisit >= 0 && iPing >= 0 && iVisit < iPing, `visita antes que ping: ${supa.calls.join(',')}`);
});

test('pendingCounts: separa records / photos / pings', async () => {
  const tables = baseTables();
  tables.visits.push(visit('v1', { synced: 0 }));
  tables.visits.push(visit('v2', { synced: 1, photos_synced: 0, photo_uri: '["x"]' }));
  tables.location_pings.push({ ping_id: 'p1', session_id: 's1', user_id: 'u1', timestamp: 't', lat: 1, lng: 2, synced: 0 });
  const counts = await pendingCounts(fakeDb(tables));
  assert.deepEqual(counts, { records: 1, photos: 1, pings: 1 });
});
