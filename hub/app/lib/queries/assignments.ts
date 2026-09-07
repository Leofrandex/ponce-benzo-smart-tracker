import { getSupabaseBrowser } from "../supabase/client";

// Asignaciones cliente→persona, con nombre. RLS: un vendedor solo ve las
// suyas; un admin ve todas. Es la fuente del filtro "Vendedor" en Tareas.
export interface TaskAssignee {
  user_id: string;
  full_name: string;
  client_id: string;
}

interface AssignmentJoinRow {
  user_id: string;
  client_id: string;
  users: { full_name: string | null } | null;
}

export async function fetchTaskAssignees(): Promise<TaskAssignee[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb
    .from("client_assignments")
    .select("user_id, client_id, users(full_name)");
  if (error) throw error;
  return ((data ?? []) as unknown as AssignmentJoinRow[]).map((a) => ({
    user_id: a.user_id,
    client_id: a.client_id,
    full_name: a.users?.full_name ?? "(sin nombre)",
  }));
}
