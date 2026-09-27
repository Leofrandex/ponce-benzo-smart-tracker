import { getSupabaseBrowser } from "../supabase/client";
import { fechaCaracas } from "./taskFilters";

export type Resultado = "completada" | "anomalia" | "cubierta" | "omitida" | "no_visitada";

export type DetalleRow = {
  fecha: string; store_id: string; store_name: string; client_name: string | null;
  resultado: Resultado; skip_reason: string | null; anomaly_type: string[] | null;
  visit_id: string | null; check_in_time: string | null;
};

export type ResumenDetalle = {
  planificadas: number; hechas: number; completadas: number; anomalias: number;
  cubiertas: number; omitidas: number; no_visitadas: number; pct: number;
};

export const RESULTADO_LABEL: Record<Resultado, string> = {
  completada: "Completada", anomalia: "Anomalía", cubierta: "Cubierta por supervisor",
  omitida: "Omitida", no_visitada: "No visitada",
};

export const SKIP_REASON_LABEL: Record<string, string> = {
  fuera_de_ruta: "Fuera de ruta", sin_acceso: "Sin acceso", otro: "Otro motivo",
};

// Mismo cálculo que fn_dash_cumplimiento: hechas = propia (completada o
// anomalía) o cubierta; pct = round(100·hechas/planificadas).
export function summarizeDetalle(rows: DetalleRow[]): ResumenDetalle {
  const n = (r: Resultado) => rows.filter((x) => x.resultado === r).length;
  const completadas = n("completada"), anomalias = n("anomalia"), cubiertas = n("cubierta");
  const hechas = completadas + anomalias + cubiertas;
  const planificadas = rows.length;
  return {
    planificadas, hechas, completadas, anomalias, cubiertas,
    omitidas: n("omitida"), no_visitadas: n("no_visitada"),
    pct: planificadas === 0 ? 0 : Math.round((100 * hechas) / planificadas),
  };
}

export type DiaDetalle = { fecha: string; resumen: ResumenDetalle; tiendas: DetalleRow[] };

export function groupByDay(rows: DetalleRow[]): DiaDetalle[] {
  const byDay = new Map<string, DetalleRow[]>();
  for (const r of rows) byDay.set(r.fecha, [...(byDay.get(r.fecha) ?? []), r]);
  return Array.from(byDay, ([fecha, tiendas]) => ({ fecha, tiendas, resumen: summarizeDetalle(tiendas) }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export type Jornada = { session_id: string; fecha: string; inicio: string; fin: string | null; minutos: number | null };

export function toJornadas(rows: { session_id: string; session_start: string; session_end: string | null }[]): Jornada[] {
  return rows.map((s) => ({
    session_id: s.session_id,
    fecha: fechaCaracas(s.session_start),
    inicio: s.session_start,
    fin: s.session_end,
    minutos: s.session_end ? Math.round((Date.parse(s.session_end) - Date.parse(s.session_start)) / 60000) : null,
  }));
}

export async function fetchDetalle(userId: string, desde: string, hasta: string): Promise<DetalleRow[]> {
  const { data, error } = await getSupabaseBrowser().rpc("fn_mercaderista_detalle", { p_user_id: userId, p_desde: desde, p_hasta: hasta });
  if (error) throw new Error(`fn_mercaderista_detalle: ${error.message}`);
  return (data ?? []) as DetalleRow[];
}

// Jornadas que empezaron dentro del periodo (fechas de Caracas, UTC-4).
export async function fetchJornadas(userId: string, desde: string, hasta: string): Promise<Jornada[]> {
  const { data, error } = await getSupabaseBrowser()
    .from("sessions")
    .select("session_id, session_start, session_end")
    .eq("user_id", userId)
    .gte("session_start", `${desde}T04:00:00Z`)
    .lt("session_start", new Date(Date.parse(`${hasta}T04:00:00Z`) + 86400000).toISOString())
    .order("session_start", { ascending: false });
  if (error) throw error;
  return toJornadas((data ?? []) as { session_id: string; session_start: string; session_end: string | null }[]);
}

// Nombre del mercaderista para el encabezado del perfil: no depende de que
// haya reportes en el periodo (a diferencia de fetchUserReports).
export async function fetchUserName(userId: string): Promise<string | null> {
  const { data, error } = await getSupabaseBrowser()
    .from("users")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.full_name ?? null;
}

// Visitas con anomalía por usuario en el periodo (RLS acota a las cadenas visibles).
export async function fetchAnomaliasPorUsuario(desde: string, hasta: string): Promise<Map<string, number>> {
  const { data, error } = await getSupabaseBrowser()
    .from("visits")
    .select("user_id")
    .eq("status", "anomaly")
    .gte("check_in_time", `${desde}T04:00:00Z`)
    .lt("check_in_time", new Date(Date.parse(`${hasta}T04:00:00Z`) + 86400000).toISOString());
  if (error) throw error;
  const out = new Map<string, number>();
  for (const v of (data ?? []) as { user_id: string }[]) out.set(v.user_id, (out.get(v.user_id) ?? 0) + 1);
  return out;
}
