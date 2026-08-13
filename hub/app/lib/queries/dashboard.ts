import { getSupabaseBrowser } from "../supabase/client";

// Las fechas viajan como 'YYYY-MM-DD'. El alcance por cliente lo aplica la base
// dentro de cada funcion: aqui no se filtra nada.

export interface Resumen {
  visitas: number;
  anomalias: number;
  tasa_anomalias: number;
  planificadas: number;
  hechas: number;
  pct_cumplimiento: number;
  tareas_abiertas: number;
  tareas_viejas: number;
}
export interface CumplimientoRow {
  user_id: string; full_name: string;
  planificadas: number; hechas: number; pct: number;
}
export interface VisitasClienteRow { cliente: string; visitas: number; anomalias: number }
export interface AnomaliaRow { tipo: string; n: number; n_periodo_anterior: number }
export interface TiendaSinVisitaRow {
  store_id: string; tienda: string; cliente: string;
  clasificacion: string | null; dias_sin_visita: number | null;
}
export interface TiendaCriticaRow {
  store_id: string; tienda: string; cliente: string; anomalias: number; visitas: number;
}
export interface BacklogRow { tramo: string; n: number }
export interface CumpleanosRow {
  contact_id: string; nombre: string; cargo: string | null;
  tienda: string; cliente: string; cumple: string; dias_para: number;
}
export interface ClienteSinVendedorRow {
  client_id: string; cliente: string; tiendas_activas: number;
}
export interface TiempoResolucion { resueltas: number; horas_promedio: number | null }

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await getSupabaseBrowser().rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return (data ?? []) as T[];
}

export async function fetchResumen(desde: string, hasta: string): Promise<Resumen> {
  const filas = await rpc<Resumen>("fn_dash_resumen", { p_desde: desde, p_hasta: hasta });
  // La funcion devuelve exactamente una fila; si no, algo cambio en la base.
  return filas[0] ?? {
    visitas: 0, anomalias: 0, tasa_anomalias: 0, planificadas: 0, hechas: 0,
    pct_cumplimiento: 0, tareas_abiertas: 0, tareas_viejas: 0,
  };
}

export const fetchCumplimiento = (desde: string, hasta: string) =>
  rpc<CumplimientoRow>("fn_dash_cumplimiento", { p_desde: desde, p_hasta: hasta });

export const fetchVisitasPorCliente = (desde: string, hasta: string) =>
  rpc<VisitasClienteRow>("fn_dash_visitas_por_cliente", { p_desde: desde, p_hasta: hasta });

export const fetchAnomalias = (desde: string, hasta: string) =>
  rpc<AnomaliaRow>("fn_dash_anomalias", { p_desde: desde, p_hasta: hasta });

export const fetchTiendasSinVisita = (dias: number) =>
  rpc<TiendaSinVisitaRow>("fn_dash_tiendas_sin_visita", { p_dias: dias });

export const fetchTiendasCriticas = (desde: string, hasta: string, limite: number) =>
  rpc<TiendaCriticaRow>("fn_dash_tiendas_criticas", { p_desde: desde, p_hasta: hasta, p_limite: limite });

export const fetchBacklogTareas = () =>
  rpc<BacklogRow>("fn_dash_backlog_tareas", {});

export const fetchCumpleanos = (dias: number) =>
  rpc<CumpleanosRow>("fn_dash_cumpleanos", { p_dias: dias });

export const fetchClientesSinVendedor = () =>
  rpc<ClienteSinVendedorRow>("fn_dash_clientes_sin_vendedor", {});

export async function fetchTiempoResolucion(desde: string, hasta: string): Promise<TiempoResolucion> {
  const filas = await rpc<TiempoResolucion>("fn_dash_tiempo_resolucion", { p_desde: desde, p_hasta: hasta });
  return filas[0] ?? { resueltas: 0, horas_promedio: null };
}
