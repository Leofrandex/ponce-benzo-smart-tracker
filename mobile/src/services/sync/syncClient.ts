import type { SupabaseClient } from "@supabase/supabase-js";
import type { SQLiteDatabase } from "expo-sqlite";
import { getUnsyncedSessions, getUnsyncedPings, getUnsyncedVisits, getUnsyncedCompetition, markSynced } from "../db";
import { uploadPhotos } from "./photoUpload";
import { toSessionPayload, toPingPayload, toVisitPayload, toCompetitionPayload } from "./payloads";

// Mensaje de error legible para los warns de fallo de sync.
const errMsg = (e: unknown) => (e instanceof Error ? e.message : JSON.stringify(e));

// Sube SOLO los location_pings pendientes. Liviano y sin fotos, pensado para
// correr desde el task de background (cada ~30s) sin esperar a que vuelva el
// foreground. Así el mapa en vivo recibe pings aunque la app esté en segundo plano.
export async function flushPings(db: SQLiteDatabase, supabase: SupabaseClient): Promise<number> {
  let pushed = 0;
  const pings = (await getUnsyncedPings(db)).filter((p) => p.user_id);
  for (const p of pings) {
    try {
      const { error } = await supabase.from("location_pings").upsert(toPingPayload(p), { onConflict: "ping_id" });
      if (error) throw error;
      await markSynced(db, "location_pings", "ping_id", p.ping_id);
      pushed++;
    } catch (e) {
      console.warn(`[sync/bg] ping ${p.ping_id} FAIL:`, errMsg(e));
    }
  }
  return pushed;
}

let isFlushing = false;
export async function flush(db: SQLiteDatabase, supabase: SupabaseClient): Promise<{ pushed: number; failed: number }> {
  if (isFlushing) return { pushed: 0, failed: 0 };
  isFlushing = true;
  let pushed = 0, failed = 0;
  try {
    const ses = await getUnsyncedSessions(db);
    const pin = (await getUnsyncedPings(db)).filter((x) => x.user_id);
    const vis = await getUnsyncedVisits(db);
    const com = await getUnsyncedCompetition(db);

    for (const s of ses) {
      try { const { error } = await supabase.from("sessions").upsert(toSessionPayload(s), { onConflict: "session_id" }); if (error) throw error; await markSynced(db,"sessions","session_id",s.session_id); pushed++; }
      catch (e) { failed++; console.warn(`[sync] session ${s.session_id} FAIL:`, errMsg(e)); }
    }
    for (const p of pin) {
      try { const { error } = await supabase.from("location_pings").upsert(toPingPayload(p), { onConflict: "ping_id" }); if (error) throw error; await markSynced(db,"location_pings","ping_id",p.ping_id); pushed++; }
      catch (e) { failed++; console.warn(`[sync] ping ${p.ping_id} FAIL:`, errMsg(e)); }
    }
    for (const v of vis) {
      try { const uris: string[] = v.photo_uri ? JSON.parse(v.photo_uri) : []; const urls = await uploadPhotos(supabase, v.user_id, v.visit_id, uris); const { error } = await supabase.from("visits").upsert(toVisitPayload(v, urls), { onConflict: "visit_id" }); if (error) throw error; await markSynced(db,"visits","visit_id",v.visit_id); pushed++; }
      catch (e) { failed++; console.warn(`[sync] visit ${v.visit_id} FAIL:`, errMsg(e)); }
    }
    for (const c of com) {
      try { const uris: string[] = c.photo_uri ? JSON.parse(c.photo_uri) : []; const urls = await uploadPhotos(supabase, c.user_id, c.report_id, uris); const { error } = await supabase.from("competition_reports").upsert(toCompetitionPayload(c, urls), { onConflict: "report_id" }); if (error) throw error; await markSynced(db,"competition_reports","report_id",c.report_id); pushed++; }
      catch (e) { failed++; console.warn(`[sync] comp ${c.report_id} FAIL:`, errMsg(e)); }
    }
  } finally { isFlushing = false; }
  return { pushed, failed };
}
