import { getSupabaseBrowser } from "../supabase/client";

export interface LivePosition {
  user_id: string;
  full_name: string;
  lat: number;
  lng: number;
  last_seen: string;
}

export interface MerchandiserRosterEntry {
  user_id: string;
  full_name: string;
}

// Roster completo de mercaderistas (todos, activos o no). El filtro del mapa lo usa
// para mostrar los 5 y marcar cuáles están activos según las posiciones en vivo.
export async function fetchMerchandisers(): Promise<MerchandiserRosterEntry[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb
    .from("users")
    .select("id, full_name")
    .eq("role", "merchandiser")
    .order("full_name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((u: { id: string; full_name: string | null }) => ({
    user_id: u.id,
    full_name: u.full_name ?? "Mercaderista",
  }));
}

// Última posición por MERCADERISTA con sesión ABIERTA (session_end IS NULL).
// Si un usuario tuviera varias sesiones abiertas (p. ej. rutas que no se cerraron),
// se muestra solo la más reciente — un marcador por persona, nunca duplicados.
export async function fetchLivePositions(): Promise<LivePosition[]> {
  const sb = getSupabaseBrowser();
  const { data: sessions, error: sErr } = await sb
    .from("sessions")
    .select("session_id, user_id, users(full_name)")
    .is("session_end", null)
    .order("session_start", { ascending: false });
  if (sErr) throw sErr;
  if (!sessions || sessions.length === 0) return [];

  const positions: LivePosition[] = [];
  const seenUsers = new Set<string>();
  for (const s of sessions as unknown as Array<{
    session_id: string;
    user_id: string;
    users: { full_name: string } | null;
  }>) {
    if (seenUsers.has(s.user_id)) continue; // ya tomamos su sesión más reciente
    seenUsers.add(s.user_id);
    const { data: ping } = await sb
      .from("location_pings")
      .select("lat, lng, timestamp")
      .eq("session_id", s.session_id)
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ping) {
      positions.push({
        user_id: s.user_id,
        full_name: s.users?.full_name ?? "Mercaderista",
        lat: (ping as { lat: number; lng: number; timestamp: string }).lat,
        lng: (ping as { lat: number; lng: number; timestamp: string }).lng,
        last_seen: (ping as { lat: number; lng: number; timestamp: string }).timestamp,
      });
    }
  }
  return positions;
}

// Puntos de calor (lat,lng) de location_pings en un rango de fechas (ISO yyyy-mm-dd),
// opcionalmente filtrado por mercaderistas. Para el mapa Histórico.
export async function fetchHeatPoints(
  from: string,
  to: string,
  merchIds: string[],
): Promise<[number, number][]> {
  const sb = getSupabaseBrowser();
  let q = sb
    .from("location_pings")
    .select("lat, lng, user_id")
    .gte("timestamp", `${from}T00:00:00`)
    .lte("timestamp", `${to}T23:59:59`)
    .limit(5000);
  if (merchIds.length > 0) q = q.in("user_id", merchIds);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((p: { lat: number; lng: number }) => [p.lat, p.lng] as [number, number]);
}
