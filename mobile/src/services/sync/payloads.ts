import type { SessionRow, VisitRow, PingRow, CompetitionRawRow, AnomalyProductRow, StoreProposalRow } from "../db";
export function toSessionPayload(r: SessionRow) {
  return { session_id:r.session_id, user_id:r.user_id, route_id:r.route_id, session_start:r.session_start, session_end:r.session_end, start_location:{ lat:r.start_lat ?? 0, lng:r.start_lng ?? 0 }, app_version: r.app_version ?? null, ota_update_id: r.ota_update_id ?? null };
}
export function toPingPayload(r: PingRow) {
  return { ping_id:r.ping_id, session_id:r.session_id, user_id:r.user_id, timestamp:r.timestamp, lat:r.lat, lng:r.lng };
}
// photo_urls no viaja en el upsert: un reintento del registro borraría lo ya enlazado.
// Solo lo escribe la fase de fotos; la columna tiene DEFAULT '{}' en Supabase.
export function toVisitPayload(r: VisitRow) {
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
  return {
    visit_id: r.visit_id,
    session_id: r.session_id,
    store_id: r.store_id,
    user_id: r.user_id,
    check_in_time: r.check_in_time,
    check_in_location: r.lat != null && r.lng != null ? { lat: r.lat, lng: r.lng } : null,
    observations: r.observations,
    status: r.status,
    anomaly_type: anomalyTypes,
    skip_reason: r.skip_reason,
    last_restock_date: r.last_restock_date,
    supervisor_present_user_id: r.supervisor_present_user_id ?? null,
    started_at: r.started_at ?? null,
  };
}
export function toGpsCaptureArgs(r: { capture_id: string; store_id: string; lat: number; lng: number; captured_at: string }) {
  return { p_capture_id: r.capture_id, p_store_id: r.store_id, p_lat: r.lat, p_lng: r.lng, p_captured_at: r.captured_at };
}
export function toCompetitionPayload(r: CompetitionRawRow) {
  return { report_id:r.report_id, session_id:r.session_id, visit_id:r.visit_id, store_id:r.store_id, user_id:r.user_id, brand_id:r.brand_id, activation_type:r.activation_type, notes:r.notes, created_at:r.created_at };
}

export function toAnomalyProductPayload(r: AnomalyProductRow) {
  return { visit_id: r.visit_id, anomaly_type: r.anomaly_type, product_id: r.product_id };
}

export function toRestockProductPayload(r: { visit_id: string; product_id: string }) {
  return { restock_id: r.visit_id, product_id: r.product_id };
}

export function toStoreProposalPayload(r: StoreProposalRow, photoUrls: string[]) {
  return {
    proposal_id: r.proposal_id, user_id: r.user_id, name: r.name, client_id: r.client_id, note: r.note,
    photo_urls: photoUrls, lat: r.lat, lng: r.lng, accuracy_m: r.accuracy_m, captured_at: r.captured_at,
  };
}
