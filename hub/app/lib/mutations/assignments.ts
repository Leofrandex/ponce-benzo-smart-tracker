import { getSupabaseBrowser } from "../supabase/client";
import { diffAssignments, type AssignmentRow } from "../queries/config";

export type AssignmentsClient = {
  insert(rows: AssignmentRow[]): Promise<{ error: { message: string } | null }>;
  remove(clientId: string, userIds: string[]): Promise<{ error: { message: string } | null }>;
};

// Inserta primero y borra después: si algo falla a mitad, la cadena nunca
// queda sin nadie por culpa del guardado. RLS (client_assignments_admin_all)
// rechaza a quien no es admin.
export async function saveClientVendorsWith(
  db: AssignmentsClient, clientId: string, current: string[], next: string[],
): Promise<{ error: string | null }> {
  const { toAdd, toRemove } = diffAssignments(current, next);
  if (toAdd.length > 0) {
    const { error } = await db.insert(toAdd.map((user_id) => ({ client_id: clientId, user_id })));
    if (error) return { error: error.message };
  }
  if (toRemove.length > 0) {
    const { error } = await db.remove(clientId, toRemove);
    if (error) return { error: error.message };
  }
  return { error: null };
}

export async function saveClientVendors(clientId: string, current: string[], next: string[]): Promise<{ error: string | null }> {
  const sb = getSupabaseBrowser();
  return saveClientVendorsWith({
    insert: async (rows) => sb.from("client_assignments").insert(rows),
    remove: async (cid, ids) => sb.from("client_assignments").delete().eq("client_id", cid).in("user_id", ids),
  }, clientId, current, next);
}
