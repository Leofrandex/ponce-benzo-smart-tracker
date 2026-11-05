import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { splitUploadable, photoCount, flush, pendingCounts, pendingPhotos } from './syncEngine';
import { deriveSyncBanner } from './bannerState';
import { expoPhotoFs } from '../services/photos/photoStore';
import { memoryDb } from '../testing/sqliteAdapter';
import { initSchema } from '../store/localStore';
import { queueGpsCapture } from '../services/storeGps';
import { toVisitPayload } from '../services/sync/payloads';

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
  const duePhotos = (rows: Row[], sql: string, now?: string, maxWait?: string): Row[] => {
    const col = /ORDER BY (\w+) DESC/.exec(sql)?.[1];
    const due = rows.filter((r) => r.synced === 1 && r.photos_synced === 0 && (
      now === undefined || r.photo_next_try == null || r.photo_next_try <= now || (maxWait !== undefined && r.photo_next_try > maxWait)
    ));
    return col ? due.sort((a, b) => (a[col] < b[col] ? 1 : -1)) : due;
  };
  const match = (sql: string, now?: string, maxWait?: string): Row[] => {
    if (sql.includes('FROM sessions')) return tables.sessions.filter((r) => r.synced === 0);
    // OJO: chequear photos_synced primero — 'photos_synced = 0' contiene 'synced = 0'.
    if (sql.includes('FROM visits') && sql.includes('photos_synced = 0')) return duePhotos(tables.visits, sql, now, maxWait);
    if (sql.includes('FROM visits') && sql.includes('synced = 0')) return tables.visits.filter((r) => r.synced === 0);
    if (sql.includes('FROM competition_reports') && sql.includes('photos_synced = 0')) return duePhotos(tables.competition_reports, sql, now, maxWait);
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
      if (sql.includes('UPDATE location_pings')) for (const r of tables.location_pings) if (args.includes(r.ping_id)) r.synced = 1;
      if (sql.includes('UPDATE restock_products SET synced=1')) {
        const r = (tables.restock_products ?? []).find((rp) => rp.visit_id === args[0] && rp.product_id === args[1]);
        if (r) r.synced = 1;
      }
    },
  } as any;
}

function fakeSupabase(opts: { failTables?: string[]; failStorage?: boolean; fkFailTables?: string[]; failUploadOnce?: string[]; noRowsOnUpdate?: boolean; failList?: boolean; upsertError?: (table: string, payload: any) => any; rpcError?: (args: any) => any; storageMessage?: string; onUpload?: () => void; existing?: string[] } = {}) {
  const calls: string[] = [];
  const updates: { table: string; payload: any }[] = [];
  const upserts: { table: string; payload: any }[] = [];
  const rpcs: { fn: string; args: any }[] = [];
  const uploaded = new Set<string>(opts.existing);
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
    rpcs,
    rpc: (fn: string, args: any) => {
      calls.push(`rpc:${fn}`);
      rpcs.push({ fn, args });
      return Promise.resolve({ data: null, error: opts.rpcError?.(args) ?? null });
    },
    from: (table: string) => ({
      upsert: (payload: any, _opts: any) => {
        calls.push(`upsert:${table}`);
        upserts.push({ table, payload });
        const error = opts.upsertError?.(table, payload);
        return error ? Promise.resolve({ error }) : result(table);
      },
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
          opts.onUpload?.();
          if (opts.storageMessage) return Promise.resolve({ error: { message: opts.storageMessage } });
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

// ── Motor fiel a la realidad (P3, B1-B5) ──────────────────────────────────────

const ping = (id: string): Row => ({ ping_id: id, session_id: 's1', user_id: 'u1', timestamp: 't', lat: 1, lng: 2, synced: 0 });
const pings = (n: number): Row[] => Array.from({ length: n }, (_, i) => ping(`p${i}`));
const upsertCalls = (supa: any, table: string) => supa.calls.filter((c: string) => c === `upsert:${table}`).length;
const report = (id: string, uris: string[]): Row => ({
  report_id: id, user_id: 'u1', created_at: '2026-07-15', photo_uri: JSON.stringify(uris), synced: 1, photos_synced: 0,
  photo_attempts: 0, photo_next_try: null, photos_done: 0,
});
// La forma real de postgrest-js sin red: code viene vacío, no ausente.
const NET_ERR = { message: 'TypeError: Network request failed', code: '' };
const CHECK_ERR = { message: 'viola un check', code: '23514' };

// Reloj que solo avanza cuando la subida simulada tarda.
function fakeClock(t: TestContext, msPerUpload: number) {
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  return () => { now += msPerUpload; };
}

test('fotos antes que pings (P3)', async (t) => {
  fakeFiles(t);
  const tables = baseTables();
  tables.visits.push(pendingVisit('v1', ['a']));
  tables.location_pings.push(ping('p1'));
  const supa = fakeSupabase();
  await flush(fakeDb(tables), supa);
  const iPhoto = supa.calls.indexOf('storage:upload:u1/v1/0.jpg');
  const iPing = supa.calls.indexOf('upsert:location_pings');
  assert.ok(iPhoto >= 0 && iPing >= 0 && iPhoto < iPing, supa.calls.join(','));
});

test('pings en lotes de 100: 250 pings son 3 upserts (P3)', async () => {
  const tables = baseTables();
  tables.location_pings.push(...pings(250));
  const supa = fakeSupabase();
  const r = await flush(fakeDb(tables), supa);
  assert.deepEqual(supa.upserts.map((u: any) => u.payload.length), [100, 100, 50]);
  assert.equal(r.pushed, 250);
  assert.equal(r.failed, 0);
  assert.ok(tables.location_pings.every((p) => p.synced === 1));
});

test('un ping rechazado no bloquea su lote (P3)', async () => {
  const tables = baseTables();
  tables.location_pings.push(ping('p1'), ping('malo'), ping('p3'));
  const supa = fakeSupabase({
    upsertError: (_t, payload) => (payload.some((p: any) => p.ping_id === 'malo') ? CHECK_ERR : null),
  });
  const r = await flush(fakeDb(tables), supa);
  assert.equal(upsertCalls(supa, 'location_pings'), 4, 'el lote y luego uno por uno');
  assert.deepEqual(tables.location_pings.map((p) => p.synced), [1, 0, 1]);
  assert.equal(r.pushed, 2);
  assert.equal(r.failed, 1);
  assert.equal(r.errorKind, 'server');
});

test('sin red, un lote fallido no reintenta uno a uno (P3)', async () => {
  const tables = baseTables();
  tables.location_pings.push(...pings(250));
  const supa = fakeSupabase({ upsertError: () => NET_ERR });
  const r = await flush(fakeDb(tables), supa);
  assert.equal(upsertCalls(supa, 'location_pings'), 1);
  assert.equal(r.failed, 100);
  assert.equal(r.errorKind, 'network');
  assert.ok(tables.location_pings.every((p) => p.synced === 0));
});

test('si la red cae en el reintento uno a uno, cuenta lo que falta del lote y para', async () => {
  const tables = baseTables();
  tables.location_pings.push(...pings(250));
  const supa = fakeSupabase({
    upsertError: (_t, payload) => {
      if (payload.length > 1) return CHECK_ERR;
      return payload[0].ping_id === 'p0' ? null : NET_ERR;
    },
  });
  const r = await flush(fakeDb(tables), supa);
  assert.equal(upsertCalls(supa, 'location_pings'), 3, 'lote, p0 y p1; nada más');
  assert.equal(r.pushed, 1);
  assert.equal(r.failed, 99);
  assert.equal(r.errorKind, 'network');
});

test('un error sin código del servidor no reintenta uno a uno', async () => {
  const tables = baseTables();
  tables.location_pings.push(...pings(3));
  const supa = fakeSupabase({ failTables: ['location_pings'] });
  const r = await flush(fakeDb(tables), supa);
  assert.equal(upsertCalls(supa, 'location_pings'), 1);
  assert.equal(r.failed, 3);
  assert.equal(r.errorKind, 'server');
});

test('flush concurrente devuelve busy true (B4)', async () => {
  const tables = baseTables();
  tables.visits.push(visit('v1'));
  const db = fakeDb(tables);
  const first = flush(db, fakeSupabase());
  assert.deepEqual(await flush(db, fakeSupabase()), { pushed: 0, failed: 0, busy: true, errorKind: null });
  const r = await first;
  assert.equal(r.busy, false);
  assert.equal(r.pushed, 1);
});

test('flush reporta errorKind network y server (B1)', async (t) => {
  const run = async (fill: (x: ReturnType<typeof baseTables>) => void, opts: Parameters<typeof fakeSupabase>[0]) => {
    const tables = baseTables();
    fill(tables);
    return flush(fakeDb(tables), fakeSupabase(opts));
  };
  const visitAndPing = (x: ReturnType<typeof baseTables>) => { x.visits.push(visit('v1')); x.location_pings.push(ping('p1')); };
  assert.equal((await run(visitAndPing, {})).errorKind, null);
  assert.equal((await run(visitAndPing, { upsertError: () => NET_ERR })).errorKind, 'network');
  assert.equal((await run(visitAndPing, { upsertError: () => CHECK_ERR })).errorKind, 'server');
  // server gana en cualquier orden.
  assert.equal((await run(visitAndPing, { upsertError: (table) => (table === 'visits' ? NET_ERR : CHECK_ERR) })).errorKind, 'server');
  assert.equal((await run(visitAndPing, { upsertError: (table) => (table === 'visits' ? CHECK_ERR : NET_ERR) })).errorKind, 'server');

  fakeFiles(t);
  const photo = (x: ReturnType<typeof baseTables>) => { x.visits.push(pendingVisit('v1', ['a'])); };
  assert.equal((await run(photo, { storageMessage: 'Network request failed' })).errorKind, 'network');
  assert.equal((await run(photo, { storageMessage: 'Bucket not found' })).errorKind, 'server');
});

test('flush se detiene antes de la siguiente foto al agotar budgetMs (B3)', async (t) => {
  fakeFiles(t);
  const tables = baseTables();
  tables.visits.push(pendingVisit('v1', ['a', 'b', 'c']));
  tables.competition_reports.push(report('r1', ['x']));
  const db = fakeDb(tables);
  const supa = fakeSupabase({ onUpload: fakeClock(t, 60) });

  // a arranca en 0 y b en 60; c ya arrancaría en 120.
  const r = await flush(db, supa, undefined, { budgetMs: 100 });
  assert.deepEqual(supa.calls.filter((c: string) => c.startsWith('storage:upload:')), ['storage:upload:u1/v1/0.jpg', 'storage:upload:u1/v1/1.jpg']);
  assert.equal(r.failed, 0, 'parar por presupuesto no es un fallo');
  assert.equal(r.errorKind, null);
  assert.equal(tables.visits[0].photos_synced, 0);
  assert.equal(tables.visits[0].photos_done, 2);
  assert.equal(tables.visits[0].photo_attempts, 0, 'no gasta intento');
  assert.equal(tables.visits[0].photo_next_try, null, 'no programa espera');
  assert.deepEqual(supa.updates.at(-1).payload.photo_urls, ['u1/v1/0.jpg', 'u1/v1/1.jpg']);
  assert.equal(tables.competition_reports[0].photos_synced, 0, 'el presupuesto vale también para los reportes');
  assert.equal((await pendingCounts(db)).photos, 2);

  // La pasada siguiente sigue donde quedó.
  await flush(db, supa);
  assert.equal(tables.visits[0].photos_synced, 1);
  assert.equal(tables.competition_reports[0].photos_synced, 1);
  assert.equal(supa.calls.filter((c: string) => c === 'storage:upload:u1/v1/0.jpg').length, 1);
});

test('el presupuesto no frena registros ni pings, solo fotos (B3)', async (t) => {
  fakeFiles(t);
  const tables = baseTables();
  tables.visits.push(visit('v1'), pendingVisit('v2', ['a']));
  tables.location_pings.push(ping('p1'));
  const supa = fakeSupabase();
  const r = await flush(fakeDb(tables), supa, undefined, { budgetMs: 0 });
  assert.equal(tables.visits[0].synced, 1);
  assert.equal(tables.location_pings[0].synced, 1);
  assert.ok(!supa.calls.some((c: string) => c.startsWith('storage:')));
  assert.equal(r.failed, 0);
});

test('al parar por presupuesto no quita del enlace una foto ya arriba', async (t) => {
  fakeFiles(t);
  const tables = baseTables();
  tables.visits.push(pendingVisit('v1', ['a', 'b', 'c']));
  const supa = fakeSupabase({ existing: ['u1/v1/2.jpg'], onUpload: fakeClock(t, 200) });
  await flush(fakeDb(tables), supa, undefined, { budgetMs: 100 });
  assert.deepEqual(supa.updates.at(-1).payload.photo_urls, ['u1/v1/0.jpg', 'u1/v1/2.jpg']);
  assert.equal(tables.visits[0].photos_synced, 0);
  assert.equal(tables.visits[0].photos_done, 2);
});

test('al parar por presupuesto sin listado no toca photo_urls', async (t) => {
  fakeFiles(t);
  const tables = baseTables();
  tables.visits.push(pendingVisit('v1', ['a', 'b']));
  const supa = fakeSupabase({ failList: true, onUpload: fakeClock(t, 200) });
  const r = await flush(fakeDb(tables), supa, undefined, { budgetMs: 100 });
  assert.equal(supa.updates.length, 0);
  assert.equal(tables.visits[0].photos_synced, 0);
  assert.equal(r.failed, 0);
});

test('onProgress se llama al avanzar (B3)', async (t) => {
  fakeFiles(t);
  const tables = baseTables();
  tables.visits.push(visit('v1'), pendingVisit('v2', ['a', 'b']));
  const seen: { v1: number; done: number; closed: number }[] = [];
  await flush(fakeDb(tables), fakeSupabase(), undefined, {
    onProgress: () => { seen.push({ v1: tables.visits[0].synced, done: tables.visits[1].photos_done, closed: tables.visits[1].photos_synced }); },
  });
  assert.deepEqual(seen, [
    { v1: 1, done: 0, closed: 0 }, // el registro
    { v1: 1, done: 1, closed: 0 }, // cada foto queda contada antes de avisar
    { v1: 1, done: 2, closed: 0 },
    { v1: 1, done: 2, closed: 1 }, // el cierre de la fila
  ]);
});

test('pendingCounts cuenta fotos reales menos las hechas (B2)', async () => {
  const tables = baseTables();
  tables.visits.push(pendingVisit('v1', ['a', 'b', 'c'], { photos_done: 1 }));
  assert.equal((await pendingCounts(fakeDb(tables))).photos, 2);

  tables.competition_reports.push(report('r1', ['x', 'y']));
  tables.visits.push(pendingVisit('ajena', ['z'], { user_id: 'u2' }));
  assert.equal((await pendingCounts(fakeDb(tables))).photos, 5);
  assert.equal((await pendingCounts(fakeDb(tables), 'u2')).photos, 1);
});

test('pendingPhotos: JSON inválido cuenta 0 y nunca da negativo (B2)', () => {
  assert.equal(pendingPhotos([{ photo_uri: '["a","b","c"]', photos_done: 1 }, { photo_uri: '["d"]', photos_done: 0 }]), 3);
  assert.equal(pendingPhotos([{ photo_uri: 'no-es-json', photos_done: 0 }]), 0);
  assert.equal(pendingPhotos([{ photo_uri: null, photos_done: 0 }]), 0);
  assert.equal(pendingPhotos([{ photo_uri: '{"a":1}', photos_done: 0 }]), 0);
  assert.equal(pendingPhotos([{ photo_uri: '["a"]', photos_done: 5 }, { photo_uri: '["b"]', photos_done: 0 }]), 1);
  assert.equal(pendingPhotos([]), 0);
});

test('fotos arriba pero sin enlazar: sigue contando como pendiente (B4)', async (t) => {
  fakeFiles(t);
  const tables = baseTables();
  tables.visits.push(pendingVisit('v1', ['a', 'b']));
  const db = fakeDb(tables);
  await flush(db, fakeSupabase({ failTables: ['visits'] }));
  assert.equal(tables.visits[0].photos_synced, 0);
  assert.equal((await pendingCounts(db)).photos, 1);
});

test('fila esperando photo_next_try: flush sin fallos pero el banner no dice Todo sincronizado (B4)', async (t) => {
  fakeFiles(t);
  const tables = baseTables();
  tables.visits.push(pendingVisit('v1', ['a'], { photo_next_try: new Date(Date.now() + 10 * 60_000).toISOString() }));
  const db = fakeDb(tables);
  const r = await flush(db, fakeSupabase());
  assert.equal(r.failed, 0);
  const counts = await pendingCounts(db);
  assert.equal(counts.photos, 1);
  assert.equal(deriveSyncBanner({ status: 'synced', records: counts.records, photos: counts.photos })!.tone, 'pending');
});

// ── Capturas de GPS: SQLite real, solo Supabase falso ─────────────────────────

async function realDb() { const db = memoryDb(); await initSchema(db); return db; }
const gpsInput = (over = {}) => ({ storeId: 'st1', userId: 'u1', lat: 10.5, lng: -66.9, nowIso: '2026-11-04T14:00:00.000Z', ...over });
const gpsRow = (db: any, id: string) => db.getFirstAsync(`SELECT synced FROM store_gps_captures WHERE capture_id=?`, id);
const gpsLogs = (db: any) => db.getAllAsync(`SELECT event, detail, user_id, level FROM sync_log WHERE event='gps_capture_rejected'`);

test('flush sube capturas antes que visitas', async () => {
  const db = await realDb();
  await db.runAsync(`INSERT INTO sessions (session_id, user_id, route_id, session_start) VALUES ('s1','u1','r1','t')`);
  await db.runAsync(`INSERT INTO visits (visit_id, session_id, store_id, user_id, check_in_time, status, photos_synced) VALUES ('v1','s1','st1','u1','t','completed',0)`);
  const id = await queueGpsCapture(db, gpsInput());
  const supa = fakeSupabase();
  const r = await flush(db, supa, 'u1');
  assert.equal(r.failed, 0);
  assert.equal(r.pushed, 3);
  assert.deepEqual(supa.calls, ['upsert:sessions', 'rpc:fn_capturar_gps_tienda', 'upsert:visits']);
  assert.deepEqual(supa.rpcs[0].args, {
    p_capture_id: id, p_store_id: 'st1', p_lat: 10.5, p_lng: -66.9, p_captured_at: '2026-11-04T14:00:00.000Z',
  });
  assert.equal((await gpsRow(db, id)).synced, 1);
});

test('las capturas no dependen del presupuesto de fotos', async () => {
  const db = await realDb();
  const id = await queueGpsCapture(db, gpsInput());
  const supa = fakeSupabase();
  await flush(db, supa, 'u1', { budgetMs: 0 });
  assert.equal(supa.rpcs.length, 1);
  assert.equal((await gpsRow(db, id)).synced, 1);
});

test('captura de otra cuenta no se sube', async () => {
  const db = await realDb();
  const ajena = await queueGpsCapture(db, gpsInput({ userId: 'u2' }));
  const propia = await queueGpsCapture(db, gpsInput());
  const supa = fakeSupabase();
  const r = await flush(db, supa, 'u1');
  assert.equal(r.failed, 0);
  assert.deepEqual(supa.rpcs.map((c: any) => c.args.p_capture_id), [propia]);
  assert.equal((await gpsRow(db, ajena)).synced, 0);
  assert.equal((await gpsRow(db, propia)).synced, 1);
});

test('captura repetida es idempotente: usa el mismo capture_id', async () => {
  const db = await realDb();
  const id = await queueGpsCapture(db, gpsInput());
  let fallar = true;
  const supa = fakeSupabase({ rpcError: () => (fallar ? { message: 'TypeError: Network request failed', code: '' } : null) });
  const primera = await flush(db, supa, 'u1');
  assert.equal(primera.failed, 1);
  assert.equal(primera.errorKind, 'network');
  assert.equal((await gpsRow(db, id)).synced, 0);
  fallar = false;
  const segunda = await flush(db, supa, 'u1');
  assert.equal(segunda.failed, 0);
  assert.deepEqual(supa.rpcs.map((c: any) => c.args.p_capture_id), [id, id]);
  assert.equal((await gpsRow(db, id)).synced, 1);
  await flush(db, supa, 'u1');
  assert.equal(supa.rpcs.length, 2, 'ya subida no se vuelve a enviar');
});

test('tienda inexistente (P0002) se cierra con log y no se reintenta', async () => {
  const db = await realDb();
  const id = await queueGpsCapture(db, gpsInput());
  const supa = fakeSupabase({ rpcError: () => ({ code: 'P0002', message: 'La tienda no existe.' }) });
  const r = await flush(db, supa, 'u1');
  assert.equal(r.failed, 0, 'reintentar no lo arregla: no es un fallo de la cola');
  assert.equal(r.pushed, 0, 'no subio nada');
  assert.equal(r.errorKind, null);
  assert.equal((await gpsRow(db, id)).synced, 1);
  const logs = await gpsLogs(db);
  assert.equal(logs.length, 1);
  assert.match(logs[0].detail, /P0002/);
  assert.match(logs[0].detail, new RegExp(id));
  assert.equal(logs[0].user_id, 'u1');
  await flush(db, supa, 'u1');
  assert.equal(supa.rpcs.length, 1, 'no se reintenta');
});

test('coordenadas invalidas (22023) tambien se cierran con log', async () => {
  const db = await realDb();
  const id = await queueGpsCapture(db, gpsInput());
  const r = await flush(db, fakeSupabase({ rpcError: () => ({ code: '22023', message: 'Coordenadas fuera de rango.' }) }), 'u1');
  assert.equal(r.failed, 0);
  assert.equal((await gpsRow(db, id)).synced, 1);
  const logs = await gpsLogs(db);
  assert.equal(logs.length, 1);
  assert.match(logs[0].detail, /22023/);
});

test('otro error de servidor queda pendiente', async () => {
  for (const code of ['42501', 'PGRST202', '500']) {
    const db = await realDb();
    const id = await queueGpsCapture(db, gpsInput());
    const r = await flush(db, fakeSupabase({ rpcError: () => ({ code, message: 'rechazado' }) }), 'u1');
    assert.equal(r.failed, 1, code);
    assert.equal(r.errorKind, 'server', code);
    assert.equal((await gpsRow(db, id)).synced, 0, code);
    assert.deepEqual(await gpsLogs(db), [], code);
  }
});

test('una captura que falla no frena las visitas', async () => {
  const db = await realDb();
  await db.runAsync(`INSERT INTO visits (visit_id, store_id, user_id, check_in_time, status, photos_synced) VALUES ('v1','st1','u1','t','completed',0)`);
  await queueGpsCapture(db, gpsInput());
  const r = await flush(db, fakeSupabase({ rpcError: () => ({ code: '42501', message: 'no' }) }), 'u1');
  assert.equal(r.failed, 1);
  assert.equal((await db.getFirstAsync<any>(`SELECT synced FROM visits`))!.synced, 1);
});

test('toVisitPayload incluye started_at', () => {
  const base = visit('v1') as any;
  assert.equal(toVisitPayload({ ...base, started_at: '2026-11-04T14:00:00.000Z' }).started_at, '2026-11-04T14:00:00.000Z');
  assert.equal(toVisitPayload({ ...base, started_at: null }).started_at, null);
  // Fila vieja sin la columna: viaja null, no se omite.
  const sinColumna = toVisitPayload(base);
  assert.ok('started_at' in sinColumna);
  assert.equal(sinColumna.started_at, null);
});

test('pendingCounts incluye capturas de GPS en records', async () => {
  const db = await realDb();
  assert.equal((await pendingCounts(db, 'u1')).records, 0);
  const id = await queueGpsCapture(db, gpsInput());
  await queueGpsCapture(db, gpsInput({ userId: 'u2' }));
  assert.equal((await pendingCounts(db, 'u1')).records, 1, 'solo la propia');
  assert.equal((await pendingCounts(db)).records, 2);
  await db.runAsync(`UPDATE store_gps_captures SET synced=1 WHERE capture_id=?`, id);
  assert.equal((await pendingCounts(db, 'u1')).records, 0);
});
