// Métricas del perfil del mercaderista. Puro: sin SQLite ni Supabase, para
// poder testearlo. ProfileScreen junta los datos y llama a estas funciones.
import type { AnomalyType, StoreStatus } from '../types';
import { fechaLocalISO } from '../utils/localDate';

export interface TodayVisitLike {
  status: string;
  check_in_time: string;
  /** JSON de string[] (como se guarda en SQLite) o null. */
  photo_uri: string | null;
  /** JSON de AnomalyType[] o null. */
  anomaly_type: string | null;
  skip_reason: string | null;
  last_restock_date: string | null;
}

export interface TodayStats {
  total: number;
  /** Completadas + con anomalía: tiendas con check-in. */
  realizadas: number;
  completadas: number;
  anomalias: number;
  omitidas: number;
  pendientes: number;
  /** Tiendas tocadas (realizadas + omitidas) / total, 0..100. */
  avancePct: number;
  /** Total de anomalías reportadas (una visita puede tener varias). */
  anomaliasReportadas: number;
  anomaliasPorTipo: Array<{ type: AnomalyType; count: number }>;
  motivoOmisionPrincipal: string | null;
  fotos: number;
  reposiciones: number;
  reportesCompetencia: number;
  minutosEnRuta: number | null;
}

function parseList(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function computeTodayStats(input: {
  routeStatuses: StoreStatus[];
  visits: TodayVisitLike[];
  competitionReports: Array<{ photo_uri: string | null }>;
  sessionStart: string | null;
  sessionEnd: string | null;
  now: Date;
}): TodayStats {
  const { routeStatuses, visits } = input;
  const count = (s: StoreStatus) => routeStatuses.filter((x) => x === s).length;
  const completadas = count('completed');
  const anomalias = count('anomaly');
  const omitidas = count('skipped');
  const pendientes = count('pending');
  const total = routeStatuses.length;
  const tocadas = completadas + anomalias + omitidas;

  const porTipo = new Map<AnomalyType, number>();
  for (const v of visits) {
    if (v.status !== 'anomaly') continue;
    for (const t of parseList(v.anomaly_type)) {
      porTipo.set(t as AnomalyType, (porTipo.get(t as AnomalyType) ?? 0) + 1);
    }
  }
  const anomaliasPorTipo = [...porTipo.entries()]
    .map(([type, c]) => ({ type, count: c }))
    .sort((a, b) => b.count - a.count);

  const motivos = new Map<string, number>();
  for (const v of visits) {
    if (v.status === 'skipped' && v.skip_reason) motivos.set(v.skip_reason, (motivos.get(v.skip_reason) ?? 0) + 1);
  }
  const motivoOmisionPrincipal = [...motivos.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const fotos =
    visits.reduce((n, v) => n + parseList(v.photo_uri).length, 0) +
    input.competitionReports.reduce((n, r) => n + parseList(r.photo_uri).length, 0);

  let minutosEnRuta: number | null = null;
  if (input.sessionStart) {
    const end = input.sessionEnd ? new Date(input.sessionEnd) : input.now;
    minutosEnRuta = Math.max(0, Math.round((end.getTime() - new Date(input.sessionStart).getTime()) / 60_000));
  }

  return {
    total,
    realizadas: completadas + anomalias,
    completadas,
    anomalias,
    omitidas,
    pendientes,
    avancePct: total > 0 ? Math.round((tocadas / total) * 100) : 0,
    anomaliasReportadas: anomaliasPorTipo.reduce((n, a) => n + a.count, 0),
    anomaliasPorTipo,
    motivoOmisionPrincipal,
    fotos,
    reposiciones: visits.filter((v) => v.last_restock_date).length,
    reportesCompetencia: input.competitionReports.length,
    minutosEnRuta,
  };
}

export interface WeekStats {
  visitas: number;
  visitasSemanaAnterior: number;
  /** Tiendas planificadas con check-in / planificadas, 0..100. null = sin rutas. */
  cumplimientoPct: number | null;
}

/**
 * Últimos 7 días locales (incluye hoy) contra los 7 anteriores.
 * Visitas = check-ins (completadas + anomalía). Cumplimiento sólo cuenta
 * rutas normales: una tienda planificada cuenta si tuvo check-in ese mismo día.
 */
export function computeWeekStats(input: {
  visits: Array<{ store_id: string; check_in_time: string; status: string }>;
  routes: Array<{ route_date: string; store_ids: string[]; is_special: boolean }>;
  now: Date;
}): WeekStats {
  const day = (offset: number) => {
    const d = new Date(input.now.getFullYear(), input.now.getMonth(), input.now.getDate() - offset, 12);
    return fechaLocalISO(d);
  };
  const desde = day(6);
  const desdeAnterior = day(13);
  const hoy = day(0);

  const checkIns = input.visits
    .filter((v) => v.status === 'completed' || v.status === 'anomaly')
    .map((v) => ({ store: v.store_id, fecha: fechaLocalISO(new Date(v.check_in_time)) }));

  const visitas = checkIns.filter((v) => v.fecha >= desde && v.fecha <= hoy).length;
  const visitasSemanaAnterior = checkIns.filter((v) => v.fecha >= desdeAnterior && v.fecha < desde).length;

  const hechas = new Set(checkIns.map((v) => `${v.fecha}|${v.store}`));
  let planificadas = 0;
  let cumplidas = 0;
  for (const r of input.routes) {
    if (r.is_special || r.route_date < desde || r.route_date > hoy) continue;
    for (const s of new Set(r.store_ids)) {
      planificadas++;
      if (hechas.has(`${r.route_date}|${s}`)) cumplidas++;
    }
  }

  return {
    visitas,
    visitasSemanaAnterior,
    cumplimientoPct: planificadas > 0 ? Math.round((cumplidas / planificadas) * 100) : null,
  };
}

export function formatDuracion(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}
