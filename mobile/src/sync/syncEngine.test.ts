import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { splitUploadable, photoCount, flush, pendingCounts } from './syncEngine';
import { expoPhotoFs } from '../services/photos/photoStore';

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
  // Fase de fotos: respeta photo_next_try y el ORDER BY de la consulta.
  const pendingPhotos = (rows: Row[], sql: string, now?: string, maxWait?: string): Row[] => {
    const col = /ORDER BY (\w+) DESC/.exec(sql)?.[1];
    const due = rows.filter((r) => r.synced === 1 && r.photos_synced === 0 && (
      now === undefined || r.photo_next_try == null || r.photo_next_try <= now || (maxWait !== undefined && r.photo_next_try > maxWait)
    ));
    return col ? due.sort((a, b) => (a[col] < b[col] ? 1 : -1)) : due;
  };
  const match = (sql: string, now?: string, maxWait?: string): Row[] => {
    if (sql.includes('FROM sessions')) return tables.sessions.filter((r) => r.synced === 0);
    // OJO: chequear photos_synced primero — 'photos_synced = 0' contiene 'synced = 0'.
    if (sql.includes('FROM visits') && sql.includes('photos_synced = 0')) return pendingPhotos(tables.visits, sql, now, maxWait);
    if (sql.includes('FROM visits') && sql.includes('synced = 0')) return tables.visits.filter((r) => r.synced === 0);
    if (sql.includes('FROM competition_reports') && sql.includes('photos_synced = 0')) return pendingPhotos(tables.competition_reports, sql, now, maxWait);
    if (sql.includes('FROM competition_reports') && sql.includes('synced = 0')) return tables.competition_reports.filter((r) => r.synced === 0);
    if (sql.includes('FROM location_pings')) return tables.location_pings.filter((r) => r.synced === 0);
    if (sql.includes('FROM restock_products')) {
      const syncedVisits = new Set(tables.visits.filter((v) => v.synced === 1).map((v) => v.visit_id));
      return (tables.restock_products ?? []).filter((r) => r.synced === 0 && syncedVisits.has(r.visit_id));
    }
    return [];
  };
  // Filtro por dueño (`... = ?` con userId): la fila es del user_id propio o del de su visita.
  const owner = (r: Row) => r.user_id ?? tables.visits.find((v) => v.visit_id === r.visit_id)?.user_id;
  return {
    getAllAsync: async (sql: string, ...args: any[]) => {
      // La consulta de fotos lleva primero la hora (photo_next_try <= ?), luego el tope
      // de espera (photo_next_try > ?) y al final el dueño.
      const now = sql.includes('photo_next_try <= ?') ? args.shift() : undefined;
      const maxWait = sql.includes('photo_next_try > ?') ? args.shift() : undefined;
      const rows = match(sql, now, maxWait);
      return args.length ? rows.filter((r) => owner(r) === args[0]) : rows;
    },
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
      if (sql.includes('INSERT INTO sync_log')) {
        tables.sync_log.push({ level: args[2], event: args[3], detail: args[4], user_id: args[5] });
        return;
      }
      const id = args[args.length - 1];
      const find = (rows: Row[], key: string) => rows.find((r) => r[key] === id);
      const photoRow = sql.includes('UPDATE visits') ? find(tables.visits, 'visit_id') : find(tables.competition_reports, 'report_id');
      if (sql.includes('SET photo_attempts')) { photoRow!.photo_attempts++; photoRow!.photo_next_try = args[0]; }
      if (sql.includes('SET photos_done')) photoRow!.photos_done = args[0];
      if (sql.includes('UPDATE sessions')) { const r = find(tables.sessions, 'session_id'); if (r) r.synced = 1; }
      if (sql.includes('UPDATE visits SET synced=1')) { const r = find(tables.visits, 'visit_id'); if (r) { r.synced = 1; r.photos_synced = args[0]; } }
      if (sql.includes('UPDATE visits SET photos_synced=1')) { const r = find(tables.visits, 'visit_id'); if (r) r.photos_synced = 1; }
      if (sql.includes('UPDATE competition_reports SET synced=1')) { const r = find(tables.competition_reports, 'report_id'); if (r) { r.synced = 1; r.photos_synced = args[0]; } }
      if (sql.includes('UPDATE competition_reports SET photos_synced=1')) { const r = find(tables.competition_reports, 'report_id'); if (r) r.photos_synced = 1; }
      if (sql.includes('UPDATE location_pings')) { const r = find(tables.location_pings, 'ping_id'); if (r) r.synced = 1; }
      if (sql.includes('UPDATE restock_products SET synced=1')) {
        const r = (tables.restock_products ?? []).find((rp) => rp.visit_id === args[0] && rp.product_id === args[1]);
        if (r) r.synced = 1;
      }
    },
  } as any;
}

function fakeSupabase(opts: { failTables?: string[]; failStorage?: boolean; fkFailTables?: string[]; failUploadOnce?: string[]; noRowsOnUpdate?: boolean; failList?: boolean } = {}) {
  const calls: string[] = [];
  const updates: { table: string; payload: any }[] = [];
  const upserts: { table: string; payload: any }[] = [];
  const uploaded = new Set<string>();
  const failedOnce = new Set<string>();
  const result = (table: string) =>
    opts.fkFailTables?.includes(table)
      ? Promise.resolve({ error: { code: '23503', message: 'violates foreign key constraint' } })
      : opts.failTables?.includes(table)
        ? Promise.resolve({ error: { message: `red caída (${table})` } })
        : Promise.resolve({ error: null });
  return {
    calls,
    updates,
    upserts,
    from: (table: string) => ({
      upsert: (payload: any, _opts: any) => { calls.push(`upsert:${table}`); upserts.push({ table, payload }); return result(table); },
      update: (payload: any) => ({
        eq: () => ({
          select: async () => {
            calls.push(`update:${table}`);
            updates.push({ table, payload });
            const { error } = await result(table);
            return { error, data: error || opts.noRowsOnUpdate ? [] : [{}] };
          },
        }),
      }),
    }),
    storage: {
      from: (_bucket: string) => ({
        list: (folder: string) => {
          calls.push('storage:list');
          if (opts.failList) return Promise.resolve({ data: null, error: { message: 'listado caído' } });
          return Promise.resolve({
            data: [...uploaded].filter((p) => p.startsWith(folder + '/')).map((p) => ({ name: p.slice(folder.length + 1) })),
            error: null,
          });
        },
        upload: (path: string) => {
          calls.push(`storage:upload:${path}`);
          if (opts.failStorage) return Promise.resolve({ error: { message: 'foto no subió' } });
          if (opts.failUploadOnce?.includes(path) && !failedOnce.has(path)) {
            failedOnce.add(path);
            return Promise.resolve({ error: { message: 'foto no subió' } });
          }
          uploaded.add(path);
          return Promise.resolve({ error: null });
        },
      }),
    },
  } as any;
}

const visit = (id: string, over: Row = {}): Row => ({
  visit_id: id, session_id: 's1', store_id: 'st1', user_id: 'u1', check_in_time: '2026-07-15T14:00:00.000Z',
  lat: 10, lng: -66, photo_uri: null, observations: null, status: 'completed',
  anomaly_type: null, skip_reason: null, last_restock_date: null, synced: 0, photos_synced: 0,
  photo_attempts: 0, photo_next_try: null, photos_done: 0, ...over,
});

// Visita ya arriba con sus fotos pendientes.
const pendingVisit = (id: string, uris: string[], over: Row = {}): Row =>
  visit(id, { synced: 1, photo_uri: JSON.stringify(uris), ...over });

const baseTables = () => ({ sessions: [] as Row[], visits: [] as Row[], competition_reports: [] as Row[], location_pings: [] as Row[], restock_products: [] as Row[], sync_log: [] as Row[] });

// Archivos locales simulados: expoPhotoFs es el fs por defecto de photoExists/deletePhotos.
function fakeFiles(t: TestContext, missing: string[] = []) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => ({ arrayBuffer: async () => new ArrayBuffer(1) })) as any;
  t.after(() => { globalThis.fetch = realFetch; });
  t.mock.method(expoPhotoFs, 'exists', async (uri: string) => !missing.includes(uri));
  const remove = t.mock.method(expoPhotoFs, 'remove', async () => {});
  return { removed: () => remove.mock.calls.map((c) => c.arguments[0]) };
}

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

test('REGRESIÓN: con userId solo sube lo de ese usuario (teléfono compartido)', async () => {
  // Cerrar sesión de un mercaderista y entrar con otra cuenta dejaba su cola en el
  // teléfono: RLS la rechazaba en cada pasada y el banner no salía de "Sincronizando".
  const tables = baseTables();
  tables.sessions.push({ session_id: 's1', user_id: 'u1', synced: 0 });
  tables.visits.push(visit('v1', { user_id: 'u1' }), visit('v2', { user_id: 'u2', session_id: 's2' }));
  tables.location_pings.push(
    { ping_id: 'p1', session_id: 's1', user_id: 'u1', timestamp: 't', lat: 1, lng: 2, synced: 0 },
    { ping_id: 'p2', session_id: 's2', user_id: 'u2', timestamp: 't', lat: 1, lng: 2, synced: 0 },
  );
  const supa = fakeSupabase();
  const r = await flush(fakeDb(tables), supa, 'u2');
  assert.equal(r.failed, 0);
  assert.deepEqual(supa.calls.filter((c: string) => c.startsWith('upsert:')), ['upsert:visits', 'upsert:location_pings']);
  assert.equal(tables.visits.find((v) => v.visit_id === 'v2')!.synced, 1);
  assert.equal(tables.visits.find((v) => v.visit_id === 'v1')!.synced, 0, 'lo de u1 espera a su dueño');
  assert.equal(tables.sessions[0].synced, 0);
  assert.equal(tables.location_pings[0].synced, 0);
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

test('flush: productos repuestos suben después de la visita y quedan synced', async () => {
  const tables = baseTables();
  tables.visits.push(visit('v1', { last_restock_date: '2026-09-20' }));
  tables.restock_products.push({ visit_id: 'v1', product_id: 'p1', synced: 0 });
  const supa = fakeSupabase();
  const r = await flush(fakeDb(tables), supa);
  assert.equal(r.failed, 0);
  assert.equal(tables.restock_products[0].synced, 1);
  assert.ok(supa.calls.indexOf('upsert:visits') < supa.calls.indexOf('upsert:restock_products'));
});

test('flush: visita con fecha de reposición y sin productos no toca restock_products', async () => {
  const tables = baseTables();
  tables.visits.push(visit('v1', { last_restock_date: '2026-09-20' }));
  const supa = fakeSupabase();
  await flush(fakeDb(tables), supa);
  assert.ok(!supa.calls.includes('upsert:restock_products'));
});

test('flush: FK 23503 en productos repuestos se descarta (no se reintenta)', async () => {
  const tables = baseTables();
  tables.visits.push(visit('v1'));
  tables.restock_products.push({ visit_id: 'v1', product_id: 'p1', synced: 0 });
  const supa = fakeSupabase({ fkFailTables: ['restock_products'] });
  const r = await flush(fakeDb(tables), supa);
  assert.equal(tables.restock_products[0].synced, 1);
  assert.equal(r.failed, 0);
});

test('flush: otro error en productos repuestos queda para reintentar', async () => {
  const tables = baseTables();
  tables.visits.push(visit('v1'));
  tables.restock_products.push({ visit_id: 'v1', product_id: 'p1', synced: 0 });
  const r = await flush(fakeDb(tables), fakeSupabase({ failTables: ['restock_products'] }));
  assert.equal(tables.restock_products[0].synced, 0);
  assert.equal(r.failed, 1);
});

test('flush: corte a mitad de las fotos + reintento → photo_urls completo sin re-subir (BUG-029)', async (t) => {
  fakeFiles(t);
  const tables = baseTables();
  tables.visits.push(visit('v1', { photo_uri: JSON.stringify(['file:///a.jpg', 'file:///b.jpg']) }));
  const db = fakeDb(tables);
  const supa = fakeSupabase({ failUploadOnce: ['u1/v1/1.jpg'] });

  await flush(db, supa);                         // sube 0.jpg, falla 1.jpg
  assert.equal(tables.visits[0].photos_synced, 0);

  tables.visits[0].photo_next_try = null;        // venció la espera
  await flush(db, supa);                         // reintento
  assert.equal(tables.visits[0].photos_synced, 1);
  assert.deepEqual(supa.updates.at(-1).payload.photo_urls, ['u1/v1/0.jpg', 'u1/v1/1.jpg']);
  assert.equal(supa.calls.filter((c: string) => c === 'storage:upload:u1/v1/0.jpg').length, 1);
  assert.equal(supa.calls.filter((c: string) => c === 'storage:upload:u1/v1/1.jpg').length, 2);
});

test('el upsert de visita y de reporte no envía photo_urls (P7)', async () => {
  const tables = baseTables();
  tables.visits.push(visit('v1'));
  tables.competition_reports.push({ report_id: 'r1', user_id: 'u1', created_at: 't', photo_uri: null, synced: 0, photos_synced: 0 });
  const supa = fakeSupabase();
  await flush(fakeDb(tables), supa);
  assert.equal(supa.upserts.length, 2);
  for (const { payload } of supa.upserts) assert.ok(!('photo_urls' in payload));
});

test('enlaza lo subido aunque otra foto falle y la visita sigue pendiente (P2)', async (t) => {
  fakeFiles(t);
  const tables = baseTables();
  tables.visits.push(pendingVisit('v1', ['a', 'b']));
  const supa = fakeSupabase({ failUploadOnce: ['u1/v1/1.jpg'] });
  await flush(fakeDb(tables), supa);
  assert.deepEqual(supa.updates.at(-1).payload.photo_urls, ['u1/v1/0.jpg']);
  assert.equal(tables.visits[0].photos_synced, 0);
  assert.equal(tables.visits[0].photos_done, 1);
});

test('foto perdida: enlaza el resto, cierra la visita y registra photo_missing (P2, P6)', async (t) => {
  const files = fakeFiles(t, ['b']);
  const tables = baseTables();
  tables.visits.push(pendingVisit('v1', ['a', 'b', 'c']));
  const supa = fakeSupabase();
  const r = await flush(fakeDb(tables), supa);
  assert.deepEqual(supa.updates.at(-1).payload.photo_urls, ['u1/v1/0.jpg', 'u1/v1/2.jpg']);
  assert.equal(tables.visits[0].photos_synced, 1);
  assert.equal(tables.visits[0].photos_done, 3);
  assert.equal(r.failed, 0);
  const logged = tables.sync_log.filter((l) => l.event === 'photo_missing');
  assert.equal(logged.length, 1);
  assert.match(logged[0].detail, /v1 foto 1/);
  assert.equal(logged[0].level, 'warn');
  assert.equal(logged[0].user_id, 'u1');
  assert.deepEqual(files.removed(), ['a', 'b', 'c']);
});

test('todas las fotos perdidas: cierra, registra cada una y no toca photo_urls', async (t) => {
  fakeFiles(t, ['a', 'b']);
  const tables = baseTables();
  tables.visits.push(pendingVisit('v1', ['a', 'b']));
  const supa = fakeSupabase();
  await flush(fakeDb(tables), supa);
  assert.equal(supa.updates.length, 0);
  assert.equal(tables.visits[0].photos_synced, 1);
  assert.equal(tables.sync_log.filter((l) => l.event === 'photo_missing').length, 2);
});

test('update sin filas afectadas no cierra la visita (P7)', async (t) => {
  const files = fakeFiles(t);
  const tables = baseTables();
  tables.visits.push(pendingVisit('v1', ['a']));
  const r = await flush(fakeDb(tables), fakeSupabase({ noRowsOnUpdate: true }));
  assert.equal(tables.visits[0].photos_synced, 0);
  assert.equal(tables.visits[0].photo_attempts, 1);
  assert.equal(r.failed, 1);
  assert.deepEqual(files.removed(), []);
});

test('update con error y sin fotos fallidas: no borra ni cierra, reintenta', async (t) => {
  const files = fakeFiles(t);
  const tables = baseTables();
  tables.visits.push(pendingVisit('v1', ['a']));
  const r = await flush(fakeDb(tables), fakeSupabase({ failTables: ['visits'] }));
  assert.equal(tables.visits[0].photos_synced, 0);
  assert.ok(tables.visits[0].photo_next_try);
  assert.equal(r.failed, 1);
  assert.deepEqual(files.removed(), []);
  assert.equal(tables.sync_log.filter((l) => l.event === 'photo_upload_fail').length, 1);
});

test('fallo: registra photo_upload_fail con causa y programa reintento (P5, P6)', async (t) => {
  fakeFiles(t);
  const tables = baseTables();
  tables.visits.push(pendingVisit('v1', ['a', 'b']));
  const r = await flush(fakeDb(tables), fakeSupabase({ failUploadOnce: ['u1/v1/1.jpg'] }));
  assert.equal(tables.visits[0].photo_attempts, 1);
  assert.ok(tables.visits[0].photo_next_try > new Date().toISOString());
  assert.equal(r.failed, 1);
  const logged = tables.sync_log.filter((l) => l.event === 'photo_upload_fail');
  assert.equal(logged.length, 1);
  assert.equal(logged[0].detail, 'v1 foto 1: foto no subió');
  assert.equal(logged[0].user_id, 'u1');
});

test('respeta photo_next_try futuro (P5)', async (t) => {
  fakeFiles(t);
  const tables = baseTables();
  tables.visits.push(pendingVisit('v1', ['a'], { photo_next_try: new Date(Date.now() + 59 * 60_000).toISOString() }));
  const supa = fakeSupabase();
  await flush(fakeDb(tables), supa);
  assert.ok(!supa.calls.some((c: string) => c.startsWith('storage:')));
  assert.equal(tables.visits[0].photos_synced, 0);
});

test('ignora un photo_next_try a más de 60 minutos: reloj del teléfono equivocado', async (t) => {
  fakeFiles(t);
  const tables = baseTables();
  tables.visits.push(pendingVisit('v1', ['a'], { photo_next_try: new Date(Date.now() + 61 * 60_000).toISOString() }));
  await flush(fakeDb(tables), fakeSupabase());
  assert.equal(tables.visits[0].photos_synced, 1);
});

test('listado caído y archivo ausente: no toca photo_urls, sigue pendiente y no borra', async (t) => {
  const files = fakeFiles(t, ['a']);
  const tables = baseTables();
  tables.visits.push(pendingVisit('v1', ['a', 'b']));
  const supa = fakeSupabase({ failList: true });
  await flush(fakeDb(tables), supa);
  assert.ok(supa.calls.includes('storage:upload:u1/v1/1.jpg'), 'la foto presente sí sube');
  assert.equal(supa.updates.length, 0);
  assert.equal(tables.visits[0].photos_synced, 0);
  assert.deepEqual(files.removed(), []);
});

test('listado caído y subida fallida: no quita del enlace la foto ya enlazada', async (t) => {
  const files = fakeFiles(t);
  const tables = baseTables();
  tables.visits.push(pendingVisit('v1', ['a', 'b']));
  const supa = fakeSupabase({ failList: true, failUploadOnce: ['u1/v1/0.jpg'] });
  await flush(fakeDb(tables), supa);
  assert.ok(supa.calls.includes('storage:upload:u1/v1/1.jpg'), 'la otra foto sí sube');
  assert.equal(supa.updates.length, 0);
  assert.equal(tables.visits[0].photos_synced, 0);
  assert.deepEqual(files.removed(), []);
});

test('listado caído pero todo subió: enlaza y cierra', async (t) => {
  const files = fakeFiles(t);
  const tables = baseTables();
  tables.visits.push(pendingVisit('v1', ['a', 'b']));
  const supa = fakeSupabase({ failList: true });
  await flush(fakeDb(tables), supa);
  assert.deepEqual(supa.updates.at(-1).payload.photo_urls, ['u1/v1/0.jpg', 'u1/v1/1.jpg']);
  assert.equal(tables.visits[0].photos_synced, 1);
  assert.deepEqual(files.removed(), ['a', 'b']);
});

test('photo_missing queda registrado aunque el cierre falle', async (t) => {
  const files = fakeFiles(t, ['a']);
  const tables = baseTables();
  tables.visits.push(pendingVisit('v1', ['a']));
  const db = fakeDb(tables);
  const run = db.runAsync;
  db.runAsync = async (sql: string, ...args: any[]) => {
    if (sql.includes('SET photos_synced=1')) throw new Error('app terminada');
    return run(sql, ...args);
  };
  await flush(db, fakeSupabase());
  assert.equal(tables.sync_log.filter((l) => l.event === 'photo_missing').length, 1);
  assert.equal(tables.visits[0].photos_synced, 0);
  assert.deepEqual(files.removed(), []);
});

for (const [name, photo_uri] of [['no es arreglo', '{"a":1}'], ['texto JSON', '"file:///a.jpg"'], ['JSON inválido', 'no-es-json']]) {
  test(`photo_uri inválido (${name}): se registra y queda pendiente, nunca se cierra`, async (t) => {
    const files = fakeFiles(t);
    const tables = baseTables();
    tables.visits.push(visit('v1', { synced: 1, photo_uri }));
    const supa = fakeSupabase();
    const r = await flush(fakeDb(tables), supa);
    assert.ok(!supa.calls.some((c: string) => c.startsWith('storage:')));
    assert.equal(tables.visits[0].photos_synced, 0);
    assert.equal(tables.visits[0].photo_attempts, 1);
    assert.equal(r.failed, 1);
    assert.equal(tables.sync_log.filter((l) => l.event === 'photo_upload_fail').length, 1);
    assert.deepEqual(files.removed(), []);
  });
}

test('sube primero la visita más reciente (P5)', async (t) => {
  fakeFiles(t);
  const tables = baseTables();
  tables.visits.push(
    pendingVisit('vieja', ['a'], { check_in_time: '2026-07-14T14:00:00.000Z' }),
    pendingVisit('nueva', ['b'], { check_in_time: '2026-07-15T14:00:00.000Z' }),
  );
  const supa = fakeSupabase();
  await flush(fakeDb(tables), supa);
  assert.deepEqual(supa.calls.filter((c: string) => c.startsWith('storage:upload:')), [
    'storage:upload:u1/nueva/0.jpg', 'storage:upload:u1/vieja/0.jpg',
  ]);
});

test('al cerrar la visita borra sus archivos locales (P1)', async (t) => {
  const files = fakeFiles(t);
  const tables = baseTables();
  tables.visits.push(pendingVisit('v1', ['a', 'b']));
  await flush(fakeDb(tables), fakeSupabase());
  assert.equal(tables.visits[0].photos_synced, 1);
  assert.deepEqual(files.removed(), ['a', 'b']);
});

test('no borra archivos si quedan fotos pendientes (P1)', async (t) => {
  const files = fakeFiles(t);
  const tables = baseTables();
  tables.visits.push(pendingVisit('v1', ['a', 'b']));
  await flush(fakeDb(tables), fakeSupabase({ failUploadOnce: ['u1/v1/1.jpg'] }));
  assert.deepEqual(files.removed(), []);
});

test('reportes de competencia: mismo trato, ordenados por created_at', async (t) => {
  const files = fakeFiles(t);
  const tables = baseTables();
  const report = (id: string, created_at: string) => ({
    report_id: id, user_id: 'u1', created_at, photo_uri: '["x"]', synced: 1, photos_synced: 0,
    photo_attempts: 0, photo_next_try: null, photos_done: 0,
  });
  tables.competition_reports.push(report('r-vieja', '2026-07-14'), report('r-nueva', '2026-07-15'));
  const supa = fakeSupabase();
  await flush(fakeDb(tables), supa);
  assert.deepEqual(supa.updates.map((u: any) => u.payload.photo_urls), [['u1/r-nueva/0.jpg'], ['u1/r-vieja/0.jpg']]);
  assert.ok(tables.competition_reports.every((r) => r.photos_synced === 1 && r.photos_done === 1));
  assert.equal(files.removed().length, 2);
});

test('teléfono compartido: no sube las fotos de otra cuenta', async (t) => {
  fakeFiles(t);
  const tables = baseTables();
  tables.visits.push(pendingVisit('v1', ['a'], { user_id: 'u1' }), pendingVisit('v2', ['b'], { user_id: 'u2' }));
  const supa = fakeSupabase();
  await flush(fakeDb(tables), supa, 'u2');
  assert.deepEqual(supa.calls.filter((c: string) => c.startsWith('storage:upload:')), ['storage:upload:u2/v2/0.jpg']);
  assert.equal(tables.visits[0].photos_synced, 0);
});

test('pendingCounts: separa records / photos / pings', async () => {
  const tables = baseTables();
  tables.visits.push(visit('v1', { synced: 0 }));
  tables.visits.push(visit('v2', { synced: 1, photos_synced: 0, photo_uri: '["x"]' }));
  tables.location_pings.push({ ping_id: 'p1', session_id: 's1', user_id: 'u1', timestamp: 't', lat: 1, lng: 2, synced: 0 });
  const counts = await pendingCounts(fakeDb(tables));
  assert.deepEqual(counts, { records: 1, photos: 1, pings: 1 });
});
