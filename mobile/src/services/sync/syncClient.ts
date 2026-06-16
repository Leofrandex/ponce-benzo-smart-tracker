import type { SupabaseClient } from "@supabase/supabase-js";
import type { SQLiteDatabase } from "expo-sqlite";
import { getUnsyncedSessions, getUnsyncedPings, getUnsyncedVisits, getUnsyncedCompetition, markSynced } from "../db";
import { uploadPhotos } from "./photoUpload";
import { toSessionPayload, toPingPayload, toVisitPayload, toCompetitionPayload } from "./payloads";

let isFlushing = false;
export async function flush(db: SQLiteDatabase, supabase: SupabaseClient): Promise<{ pushed: number; failed: number }> {
  if (isFlushing) return { pushed: 0, failed: 0 };
  isFlushing = true;
  let pushed = 0, failed = 0;
  try {
    for (const s of await getUnsyncedSessions(db)) {
      try { const { error } = await supabase.from("sessions").upsert(toSessionPayload(s), { onConflict: "session_id" }); if (error) throw error; await markSynced(db,"sessions","session_id",s.session_id); pushed++; } catch { failed++; }
    }
    for (const p of (await getUnsyncedPings(db)).filter((x) => x.user_id)) {
      try { const { error } = await supabase.from("location_pings").upsert(toPingPayload(p), { onConflict: "ping_id" }); if (error) throw error; await markSynced(db,"location_pings","ping_id",p.ping_id); pushed++; } catch { failed++; }
    }
    for (const v of await getUnsyncedVisits(db)) {
      try { const uris: string[] = v.photo_uri ? JSON.parse(v.photo_uri) : []; const urls = await uploadPhotos(supabase, v.user_id, v.visit_id, uris); const { error } = await supabase.from("visits").upsert(toVisitPayload(v, urls), { onConflict: "visit_id" }); if (error) throw error; await markSynced(db,"visits","visit_id",v.visit_id); pushed++; } catch { failed++; }
    }
    for (const c of await getUnsyncedCompetition(db)) {
      try { const uris: string[] = c.photo_uri ? JSON.parse(c.photo_uri) : []; const urls = await uploadPhotos(supabase, c.user_id, c.report_id, uris); const { error } = await supabase.from("competition_reports").upsert(toCompetitionPayload(c, urls), { onConflict: "report_id" }); if (error) throw error; await markSynced(db,"competition_reports","report_id",c.report_id); pushed++; } catch { failed++; }
    }
  } finally { isFlushing = false; }
  return { pushed, failed };
}
