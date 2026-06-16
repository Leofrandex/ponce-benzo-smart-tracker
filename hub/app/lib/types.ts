// App domain types

export interface Store {
  store_id: string;
  name: string;
  address: string | null;
  master_lat: number;
  master_lng: number;
  active: boolean;
  created_at: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  estado: string | null;
  municipio: string | null;
  urbanizacion: string | null;
  business_channel:
    | "drogueria" | "farmacia" | "supermercado"
    | "autoservicio" | "mayorista" | "otro" | null;
  classification: "A" | "B" | "C" | null;
  client_id?: string | null;
  client_name?: string | null;
}

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: "merchandiser" | "supervisor" | "admin";
  active: boolean;
  created_at: string;
  supervisor_id: string | null;
}

export interface Route {
  route_id: string;
  user_id: string;
  route_date: string; // ISO date string "YYYY-MM-DD"
  store_ids: string[];
  created_at: string;
  is_special: boolean;
}

export interface Session {
  session_id: string;
  user_id: string;
  route_id: string;
  session_start: string;
  session_end: string | null;
  start_location: { lat: number; lng: number };
  created_at: string;
}

export interface Visit {
  visit_id: string;
  session_id: string;
  store_id: string;
  user_id: string;
  check_in_time: string;
  check_in_location: { lat: number; lng: number } | null;
  photo_urls: string[];
  observations: string | null;
  status: "completed" | "skipped" | "anomaly";
  synced: boolean;
  created_at: string;
  anomaly_type:
    | "sin_stock" | "cambio_planograma" | "diferencia_precios"
    | "producto_danado" | "otro" | null;
  skip_reason: "fuera_de_ruta" | "sin_acceso" | "otro" | null;
  last_restock_date: string | null;
}

// Client-only status (pending = no visit recorded yet)
export type StoreStatus = "pending" | "completed" | "skipped" | "anomaly";

// VisitRecord used by the checkin form and historial
export interface VisitRecord {
  visit_id: string;
  store_id: string;
  check_in_time: string;
  check_in_location: { lat: number; lng: number } | null;
  observations: string;
  status: StoreStatus;
  synced: boolean;
}

// ── Contactos (supervisor view of stores) ─────────────────────────────────────

export interface ContactListItem {
  store_id: string;
  name: string;
  address: string | null;
  active: boolean;
  last_visit_date: string | null;
  last_visit_status: "completed" | "skipped" | "anomaly" | null;
  pending_tasks_count: number;
}

export interface StoreKPIs {
  total_visits: number;
  completed_count: number;
  anomaly_count: number;
  skipped_count: number;
  compliance_pct: number;
  avg_days_between_visits: number | null;
}

// ── Supervisor types (no DB tables yet — backed by mock data) ─────────────────

// NOTE: TaskType / TaskStatus / SupervisorTask below are MOCK-ONLY UI types (English
// vocabulary), kept until the CRM UI is reconciled with the live `tasks` table.
// For DB-backed tasks use `Task` + `DbTaskType` (Spanish DB vocabulary) instead.
export type TaskType =
  | "restock"
  | "contact_manager"
  | "pricing_issue"
  | "display_damage"
  | "other";

export type TaskStatus = "open" | "resolved";

export interface SupervisorTask {
  task_id: string;
  store_id: string;
  store_name: string;
  client_name: string;
  merchandiser_name: string;
  created_at: string;
  type: TaskType;
  description: string;
  status: TaskStatus;
}

export interface SupervisorReport {
  visit_id: string;
  store_id: string;
  store_name: string;
  store_address: string;
  client_name: string;
  merchandiser_name: string;
  check_in_time: string;
  duration_minutes: number;        // mock-only — sin respaldo en BD (no hay check-out), a extinguir al cablear
  status: "completed" | "skipped" | "anomaly";
  observations: string;
  photos_count: number;
  location_verified: boolean;      // mock-only — sin respaldo en BD, a extinguir al cablear
  tasks_count: number;
  photo_urls: string[];            // NEW — real thumbnail URLs for the activity feed
  last_restock_date: string | null; // NEW — restock date captured on this visit
}

export interface Contact {
  contact_id: string;
  store_id: string;
  full_name: string;
  role_title: string | null;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  is_primary: boolean;
  active: boolean;
  created_at: string;
}

export interface ContactEngagement {
  engagement_id: string;
  store_id: string;
  contact_id: string | null;
  author_user_id: string | null;
  type: "note" | "todo";
  body: string;
  status: "open" | "done" | null;
  due_date: string | null;
  created_at: string;
}

// DB-backed task types (mirror tasks.task_type values produced by the anomaly trigger).
// Distinct from the mock-only `TaskType` above — see note there.
export type DbTaskType =
  | "reponer_stock" | "contactar_comprador" | "contactar_gerente" | "revisar_anomalia";

export interface Task {
  task_id: string;
  assignee_user_id: string | null;
  created_by_user_id: string | null;
  store_id: string | null;
  source_visit_id: string | null;
  task_type: DbTaskType | (string & {});
  title: string | null;
  description: string | null; // contexto del check-in (el trigger copia visits.observations)
  status: "open" | "resolved";
  created_at: string;
}

export interface CompetitorBrand {
  brand_id: string;
  name: string;
  active: boolean;
}

export interface CompetitionReport {
  report_id: string;
  session_id: string | null;
  visit_id: string | null; // check-in al que está ligado el reporte
  store_id: string | null;
  user_id: string;
  brand_id: string | null;
  activation_type:
    | "promocion" | "material_pop" | "espacios_exhibiciones"
    | "impulso_activacion" | "degustacion" | "otro" | null;
  photo_urls: string[];
  notes: string | null;
  created_at: string;
  synced: boolean;
}
