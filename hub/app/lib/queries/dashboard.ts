import { getSupabaseBrowser } from "../supabase/client";
import type { DashboardVisitRow, DashboardTaskRow } from "./derive";

interface VisitJoin {
  visit_id: string;
  store_id: string;
  check_in_time: string;
  status: "completed" | "skipped" | "anomaly";
  users: { full_name: string | null } | null;
  stores: { clients: { name: string | null } | null } | null;
}

export async function fetchDashboardVisits(): Promise<DashboardVisitRow[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb
    .from("visits")
    .select("visit_id, store_id, check_in_time, status, users(full_name), stores(clients(name))");
  if (error) throw error;
  return ((data ?? []) as unknown as VisitJoin[]).map((v) => ({
    visit_id: v.visit_id,
    store_id: v.store_id,
    check_in_time: v.check_in_time,
    status: v.status,
    merchandiser_name: v.users?.full_name ?? null,
    client_name: v.stores?.clients?.name ?? null,
  }));
}

interface TaskJoin {
  task_id: string;
  store_id: string | null;
  status: "open" | "resolved";
  created_at: string;
  creator: { full_name: string | null } | null;
}

export async function fetchDashboardTasks(): Promise<DashboardTaskRow[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb
    .from("tasks")
    .select("task_id, store_id, status, created_at, creator:users!tasks_created_by_user_id_fkey(full_name)");
  if (error) throw error;
  return ((data ?? []) as unknown as TaskJoin[]).map((t) => ({
    task_id: t.task_id,
    store_id: t.store_id,
    status: t.status,
    created_at: t.created_at,
    merchandiser_name: t.creator?.full_name ?? null,
  }));
}

export async function fetchActiveStoreCount(): Promise<number> {
  const sb = getSupabaseBrowser();
  const { count, error } = await sb
    .from("stores")
    .select("store_id", { count: "exact", head: true })
    .eq("active", true);
  if (error) throw error;
  return count ?? 0;
}
