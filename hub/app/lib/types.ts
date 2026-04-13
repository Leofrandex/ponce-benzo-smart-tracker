// Database types matching tools/supabase_schema.sql

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
}

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: "merchandiser" | "supervisor" | "admin";
  active: boolean;
  created_at: string;
}

export interface Route {
  route_id: string;
  user_id: string;
  route_date: string; // ISO date string "YYYY-MM-DD"
  store_ids: string[];
  created_at: string;
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

export type TaskType =
  | "restock"
  | "contact_manager"
  | "pricing_issue"
  | "display_damage"
  | "other";

export type TaskPriority = "high" | "medium" | "low";
export type TaskStatus = "open" | "in_progress" | "resolved";

export interface SupervisorTask {
  task_id: string;
  store_id: string;
  store_name: string;
  client_name: string;
  merchandiser_name: string;
  created_at: string;
  type: TaskType;
  description: string;
  priority: TaskPriority;
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
  duration_minutes: number;
  status: "completed" | "skipped" | "anomaly";
  observations: string;
  photos_count: number;
  location_verified: boolean;
  tasks_count: number;
}
