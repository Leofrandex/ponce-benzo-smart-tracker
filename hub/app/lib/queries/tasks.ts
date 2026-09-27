import { getSupabaseBrowser } from "../supabase/client";
import type { TaskRow } from "./derive";
import { fetchAllPages } from "./paginate";

export async function fetchTasks(): Promise<TaskRow[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.from("tasks").select("task_id, store_id, status");
  if (error) throw error;
  return (data ?? []) as TaskRow[];
}

// Productos que el mercaderista marcó en la visita que originó la tarea.
// Incluye todos los tipos de anomalía de esa visita; taskProducts() se queda
// con los del tipo de la tarea.
export interface TaskAnomalyProduct {
  anomaly_type: string;
  product_id: string;
  name: string;
  brand: string | null;
  line: string | null;
}

// Tarea completa para la pantalla de Tareas (lectura).
export interface FullTaskRow {
  task_id: string;
  store_id: string | null;
  store_name: string | null;
  client_id: string | null;
  client_name: string | null;
  estado: string | null;
  municipio: string | null;
  urbanizacion: string | null;
  created_by_name: string | null;
  task_type: string;
  title: string | null;
  description: string | null;
  status: "open" | "resolved";
  created_at: string;
  assignee_user_id: string | null;
  source_visit_id: string | null;
  resolution_note: string | null;
  resolution_note_at: string | null;
  resolution_note_by_name: string | null;
  anomaly_products: TaskAnomalyProduct[];
}

interface TaskJoinRow {
  task_id: string;
  store_id: string | null;
  task_type: string;
  title: string | null;
  description: string | null;
  status: "open" | "resolved";
  created_at: string;
  assignee_user_id: string | null;
  source_visit_id: string | null;
  resolution_note: string | null;
  resolution_note_at: string | null;
  stores: {
    name: string | null;
    estado: string | null;
    municipio: string | null;
    urbanizacion: string | null;
    client_id: string | null;
    clients: { name: string | null } | null;
  } | null;
  creator: { full_name: string | null } | null;
  note_author: { full_name: string | null } | null;
  source_visit: {
    visit_anomaly_products: {
      anomaly_type: string;
      products: { product_id: string; name: string; brand: string | null; line: string | null } | null;
    }[];
  } | null;
}

export async function fetchFullTasks(): Promise<FullTaskRow[]> {
  const sb = getSupabaseBrowser();
  const rows = await fetchAllPages<TaskJoinRow>(async (from, to) => {
    const { data, error } = await sb
      .from("tasks")
      .select(
        "task_id, store_id, task_type, title, description, status, created_at, assignee_user_id, source_visit_id, " +
          "resolution_note, resolution_note_at, " +
          "stores(name, estado, municipio, urbanizacion, client_id, clients(name)), creator:users!tasks_created_by_user_id_fkey(full_name), " +
          "note_author:users!tasks_resolution_note_by_fkey(full_name), " +
          "source_visit:visits!tasks_source_visit_id_fkey(visit_anomaly_products(anomaly_type, products(product_id, name, brand, line)))",
      )
      // Orden total y estable: sin task_id, dos tareas con el mismo created_at
      // podrían saltar de página entre llamadas.
      .order("created_at", { ascending: false })
      .order("task_id", { ascending: true })
      .range(from, to);
    if (error) throw error;
    return (data ?? []) as unknown as TaskJoinRow[];
  });
  return rows.map((t) => ({
    task_id: t.task_id,
    store_id: t.store_id,
    store_name: t.stores?.name ?? null,
    client_id: t.stores?.client_id ?? null,
    client_name: t.stores?.clients?.name ?? null,
    estado: t.stores?.estado ?? null,
    municipio: t.stores?.municipio ?? null,
    urbanizacion: t.stores?.urbanizacion ?? null,
    created_by_name: t.creator?.full_name ?? null,
    task_type: t.task_type,
    title: t.title,
    description: t.description,
    status: t.status,
    created_at: t.created_at,
    assignee_user_id: t.assignee_user_id,
    source_visit_id: t.source_visit_id,
    resolution_note: t.resolution_note,
    resolution_note_at: t.resolution_note_at,
    resolution_note_by_name: t.note_author?.full_name ?? null,
    anomaly_products: (t.source_visit?.visit_anomaly_products ?? [])
      .filter((p) => p.products)
      .map((p) => ({
        anomaly_type: p.anomaly_type,
        product_id: p.products!.product_id,
        name: p.products!.name,
        brand: p.products!.brand,
        line: p.products!.line,
      })),
  }));
}
