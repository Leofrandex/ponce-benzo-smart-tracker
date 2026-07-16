import { getSupabaseBrowser } from "../supabase/client";
import type { TaskRow } from "./derive";

export async function fetchTasks(): Promise<TaskRow[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.from("tasks").select("task_id, store_id, status");
  if (error) throw error;
  return (data ?? []) as TaskRow[];
}

// Tarea completa para la pantalla de Tareas (lectura).
export interface FullTaskRow {
  task_id: string;
  store_id: string | null;
  store_name: string | null;
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
  stores: { name: string | null; estado: string | null; municipio: string | null; urbanizacion: string | null } | null;
  creator: { full_name: string | null } | null;
}

export async function fetchFullTasks(): Promise<FullTaskRow[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb
    .from("tasks")
    .select(
      "task_id, store_id, task_type, title, description, status, created_at, assignee_user_id, source_visit_id, " +
        "stores(name, estado, municipio, urbanizacion), creator:users!tasks_created_by_user_id_fkey(full_name)",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as TaskJoinRow[]).map((t) => ({
    task_id: t.task_id,
    store_id: t.store_id,
    store_name: t.stores?.name ?? null,
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
  }));
}
