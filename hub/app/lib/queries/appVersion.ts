import { getSupabaseBrowser } from "../supabase/client";
import { fetchAllPages } from "./paginate";

// Versión de la app instalada en los teléfonos. Al publicar un APK nuevo, subir este valor.
export const VERSION_VIGENTE = "1.3.0";

export function compararVersiones(a: string, b: string): number {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

// Las apps anteriores a 1.3.0 no reportan versión: null = anterior.
export function estadoVersion(v: string | null | undefined): { texto: string; desactualizada: boolean } {
  if (!v) return { texto: `Anterior a ${VERSION_VIGENTE}`, desactualizada: true };
  return { texto: `v${v}`, desactualizada: compararVersiones(v, VERSION_VIGENTE) < 0 };
}

export type SessionVersionRow = { user_id: string; app_version: string | null; session_start: string };

// Filas ordenadas por session_start desc: la primera de cada usuario es la vigente.
export function ultimaVersionPorUsuario(rows: SessionVersionRow[]): Map<string, string | null> {
  const m = new Map<string, string | null>();
  for (const r of rows) if (!m.has(r.user_id)) m.set(r.user_id, r.app_version);
  return m;
}

// Jornadas de los últimos 30 días (5 mercaderistas → ~150 filas).
export async function fetchVersiones(): Promise<Map<string, string | null>> {
  const desde = new Date(Date.now() - 30 * 86400000).toISOString();
  const sb = getSupabaseBrowser();
  const rows = await fetchAllPages<SessionVersionRow>(async (from, to) => {
    const { data, error } = await sb
      .from("sessions")
      .select("user_id, app_version, session_start")
      .gte("session_start", desde)
      .order("session_start", { ascending: false })
      .order("session_id", { ascending: true })
      .range(from, to);
    if (error) throw error;
    return (data ?? []) as SessionVersionRow[];
  });
  return ultimaVersionPorUsuario(rows);
}
