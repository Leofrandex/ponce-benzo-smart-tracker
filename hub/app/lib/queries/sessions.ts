import { getSupabaseBrowser } from "../supabase/client";

export interface LivePosition {
  user_id: string;
  full_name: string;
  lat: number;
  lng: number;
  last_seen: string;
}

// Última posición por sesión ABIERTA (session_end IS NULL).
export async function fetchLivePositions(): Promise<LivePosition[]> {
  const sb = getSupabaseBrowser();
  const { data: sessions, error: sErr } = await sb
    .from("sessions")
    .select("session_id, user_id, users(full_name)")
    .is("session_end", null);
  if (sErr) throw sErr;
  if (!sessions || sessions.length === 0) return [];

  const positions: LivePosition[] = [];
  for (const s of sessions as unknown as Array<{
    session_id: string;
    user_id: string;
    users: { full_name: string } | null;
  }>) {
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
