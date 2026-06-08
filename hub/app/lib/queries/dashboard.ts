import { getSupabaseBrowser } from "../supabase/client";
import type { VisitRow, TaskRow } from "./derive";

export async function fetchVisitsRaw(): Promise<VisitRow[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.from("visits").select("visit_id, store_id, check_in_time, status");
  if (error) throw error;
  return (data ?? []) as VisitRow[];
}

export async function fetchTasksRaw(): Promise<TaskRow[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.from("tasks").select("task_id, store_id, status");
  if (error) throw error;
  return (data ?? []) as TaskRow[];
}
