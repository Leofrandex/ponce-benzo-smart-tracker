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
    | 'drogueria' | 'farmacia' | 'supermercado'
    | 'autoservicio' | 'mayorista' | 'otro' | null;
  classification: 'A' | 'B' | 'C' | null;
}

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: 'merchandiser' | 'supervisor' | 'admin';
  active: boolean;
  created_at: string;
  supervisor_id: string | null;
}

export interface Route {
  route_id: string;
  user_id: string;
  route_date: string;
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

export type AnomalyType =
  | 'sin_stock' | 'cambio_planograma' | 'diferencia_precios'
  | 'producto_danado' | 'otro';

export interface Visit {
  visit_id: string;
  session_id: string;
  store_id: string;
  user_id: string;
  check_in_time: string;
  check_in_location: { lat: number; lng: number } | null;
  photo_urls: string[];
  observations: string | null;
  status: 'completed' | 'skipped' | 'anomaly';
  synced: boolean;
  created_at: string;
  anomaly_type: AnomalyType[] | null;
  skip_reason: 'fuera_de_ruta' | 'sin_acceso' | 'otro' | null;
  last_restock_date: string | null;
}

export type StoreStatus = 'pending' | 'completed' | 'skipped' | 'anomaly';

export interface VisitRecord {
  visit_id: string;
  store_id: string;
  check_in_time: string;
  check_in_location: { lat: number; lng: number } | null;
  photo_uris: string[];
  observations: string;
  status: StoreStatus;
  synced: boolean;
  anomaly_type: Visit['anomaly_type'];
  skip_reason: Visit['skip_reason'];
  last_restock_date: string | null;
}

export type GPSState = 'idle' | 'searching' | 'found' | 'error';

export interface RouteStoreItem {
  store: Store;
  order: number;
  status: StoreStatus;
  visit?: VisitRecord;
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
  type: 'note' | 'todo';
  body: string;
  status: 'open' | 'done' | null;
  due_date: string | null;
  created_at: string;
}

// DB-backed task types (mirror tasks.task_type values from the anomaly trigger).
export type DbTaskType =
  | 'reponer_stock' | 'contactar_comprador' | 'contactar_gerente' | 'revisar_anomalia';

export interface Task {
  task_id: string;
  assignee_user_id: string | null;
  created_by_user_id: string | null;
  store_id: string | null;
  source_visit_id: string | null;
  task_type: DbTaskType | (string & {});
  title: string | null;
  status: 'pending' | 'in_progress' | 'done';
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
  store_id: string | null;
  user_id: string;
  brand_id: string | null;
  activation_type:
    | 'promocion' | 'material_pop' | 'espacios_exhibiciones'
    | 'impulso_activacion' | 'degustacion' | 'otro' | null;
  photo_urls: string[];
  notes: string | null;
  created_at: string;
  synced: boolean;
}

// Forma del formulario de reporte de competencia en la UI móvil.
// El store_id NO va aquí: lo deriva RouteContext de la visita en curso.
export interface CompetitionReportRecord {
  report_id: string;
  brand_id: string | null;
  activation_type: CompetitionReport['activation_type'];
  photo_uris: string[];
  notes: string | null;
}
