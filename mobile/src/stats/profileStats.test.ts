import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTodayStats, computeWeekStats, formatDuracion } from './profileStats';

const v = (o: Partial<Parameters<typeof computeTodayStats>[0]['visits'][number]>) => ({
  status: 'completed', check_in_time: '2026-11-12T13:00:00Z', photo_uri: null,
  anomaly_type: null, skip_reason: null, last_restock_date: null, ...o,
});

test('hoy: realizadas = completadas + anomalía; omitidas no cuentan', () => {
  const s = computeTodayStats({
    routeStatuses: ['completed', 'completed', 'anomaly', 'skipped', 'pending'],
    visits: [], competitionReports: [], sessionStart: null, sessionEnd: null, now: new Date(),
  });
  assert.equal(s.realizadas, 3);
  assert.equal(s.omitidas, 1);
  assert.equal(s.pendientes, 1);
  assert.equal(s.avancePct, 80);
  assert.equal(s.minutosEnRuta, null);
});

test('hoy: ruta vacía no divide por cero', () => {
  const s = computeTodayStats({ routeStatuses: [], visits: [], competitionReports: [], sessionStart: null, sessionEnd: null, now: new Date() });
  assert.equal(s.avancePct, 0);
});

test('hoy: anomalías por tipo, fotos, reposiciones y motivo de omisión', () => {
  const s = computeTodayStats({
    routeStatuses: ['anomaly', 'anomaly', 'skipped'],
    visits: [
      v({ status: 'anomaly', anomaly_type: '["sin_stock","diferencia_precios"]', photo_uri: '["a","b"]', last_restock_date: '2026-11-10' }),
      v({ status: 'anomaly', anomaly_type: '["sin_stock"]', photo_uri: 'roto' }),
      v({ status: 'skipped', skip_reason: 'sin_acceso' }),
    ],
    competitionReports: [{ photo_uri: '["c"]' }],
    sessionStart: '2026-11-12T12:00:00Z', sessionEnd: null, now: new Date('2026-11-12T13:30:00Z'),
  });
  assert.deepEqual(s.anomaliasPorTipo, [{ type: 'sin_stock', count: 2 }, { type: 'diferencia_precios', count: 1 }]);
  assert.equal(s.anomaliasReportadas, 3);
  assert.equal(s.fotos, 3);
  assert.equal(s.reposiciones, 1);
  assert.equal(s.reportesCompetencia, 1);
  assert.equal(s.motivoOmisionPrincipal, 'sin_acceso');
  assert.equal(s.minutosEnRuta, 90);
});

test('semana: visitas y cumplimiento contra rutas normales', () => {
  const now = new Date(2026, 10, 12, 15); // 12 nov local
  const at = (d: number, h = 10, m = 10) => new Date(2026, m, d, h).toISOString();
  const w = computeWeekStats({
    now,
    visits: [
      { store_id: 'a', check_in_time: at(12), status: 'completed' },
      { store_id: 'b', check_in_time: at(12), status: 'skipped' },
      { store_id: 'a', check_in_time: at(10), status: 'anomaly' },
      { store_id: 'z', check_in_time: at(3), status: 'completed' }, // semana anterior
      { store_id: 'y', check_in_time: at(25, 10, 9), status: 'completed' }, // 25 oct: fuera de rango
    ],
    routes: [
      { route_date: '2026-11-12', store_ids: ['a', 'b'], is_special: false },
      { route_date: '2026-11-10', store_ids: ['a', 'c'], is_special: false },
      { route_date: '2026-11-11', store_ids: ['x'], is_special: true },
    ],
  });
  assert.equal(w.visitas, 2);
  assert.equal(w.visitasSemanaAnterior, 1);
  assert.equal(w.cumplimientoPct, 50);
});

test('semana: sin rutas el cumplimiento es null', () => {
  assert.equal(computeWeekStats({ now: new Date(), visits: [], routes: [] }).cumplimientoPct, null);
});

test('formatDuracion', () => {
  assert.equal(formatDuracion(45), '45 min');
  assert.equal(formatDuracion(204), '3 h 24 min');
});
