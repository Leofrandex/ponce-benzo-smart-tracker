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
  task_type: string;
  title: string | null;
  description: string | null;
  status: "open" | "resolved";
  created_at: string;
  assignee_user_id: string | null;
}

export async function fetchFullTasks(): Promise<FullTaskRow[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb
    .from("tasks")
    .select("task_id, store_id, task_type, title, description, status, created_at, assignee_user_id")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FullTaskRow[];
}
