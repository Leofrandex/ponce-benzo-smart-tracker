import type { SessionRow, VisitRow, PingRow, CompetitionRawRow } from "../db";
export function toSessionPayload(r: SessionRow) {
  return { session_id:r.session_id, user_id:r.user_id, route_id:r.route_id, session_start:r.session_start, session_end:r.session_end, start_location:{ lat:r.start_lat ?? 0, lng:r.start_lng ?? 0 } };
}
export function toPingPayload(r: PingRow) {
  return { ping_id:r.ping_id, session_id:r.session_id, user_id:r.user_id, timestamp:r.timestamp, lat:r.lat, lng:r.lng };
}
export function toVisitPayload(r: VisitRow, photoUrls: string[]) {
  let anomalyTypes: string[] | null = null;
  if (r.anomaly_type) {
    try {
      const parsed = JSON.parse(r.anomaly_type);
      anomalyTypes = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // Compat: filas viejas guardaban un único valor sin JSON.
      anomalyTypes = [r.anomaly_type];
    }
  }
  return { visit_id:r.visit_id, session_id:r.session_id, store_id:r.store_id, user_id:r.user_id, check_in_time:r.check_in_time, check_in_location: r.lat != null && r.lng != null ? { lat:r.lat, lng:r.lng } : null, photo_urls:photoUrls, observations:r.observations, status:r.status, anomaly_type:anomalyTypes, skip_reason:r.skip_reason, last_restock_date:r.last_restock_date };
}
export function toCompetitionPayload(r: CompetitionRawRow, photoUrls: string[]) {
  return { report_id:r.report_id, session_id:r.session_id, visit_id:r.visit_id, store_id:r.store_id, user_id:r.user_id, brand_id:r.brand_id, activation_type:r.activation_type, photo_urls:photoUrls, notes:r.notes, created_at:r.created_at };
}
