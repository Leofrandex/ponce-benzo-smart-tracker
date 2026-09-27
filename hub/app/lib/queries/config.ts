import { getSupabaseBrowser } from "../supabase/client";
import { roleLabel } from "../roles";
import { fetchClients, type ClientRow } from "./clients";

export type ConfigUser = { id: string; full_name: string; role: string; active: boolean };
export type AssignmentRow = { client_id: string; user_id: string };
export type AssignedPerson = { user_id: string; full_name: string; role: string };
export type VendorAssignRow = { client_id: string; name: string; store_count: number; assigned: AssignedPerson[] };

export const FILTRO_SIN_VENDEDOR = "sin-vendedor";

const byName = (a: string, b: string) => a.localeCompare(b, "es");

export function buildVendorRows(clients: ClientRow[], assignments: AssignmentRow[], users: ConfigUser[]): VendorAssignRow[] {
  const userById = new Map(users.map((u) => [u.id, u]));
  const byClient = new Map<string, AssignedPerson[]>();
  for (const a of assignments) {
    const u = userById.get(a.user_id);
    const list = byClient.get(a.client_id) ?? [];
    // Una asignación a alguien que no aparece en users se muestra igual, para
    // que el admin la vea y pueda quitarla.
    list.push({ user_id: a.user_id, full_name: u?.full_name ?? "(usuario desconocido)", role: u?.role ?? "" });
    byClient.set(a.client_id, list);
  }
  return clients
    .map((c) => ({
      client_id: c.client_id,
      name: c.name,
      store_count: c.store_count,
      assigned: (byClient.get(c.client_id) ?? []).sort((x, y) => byName(x.full_name, y.full_name)),
    }))
    .sort((a, b) => byName(a.name, b.name));
}

// Opciones del selector: vendedores activos + cualquiera que ya esté asignado
// (p. ej. mercaderistas dueños de una cadena o vendedores inactivos), para que
// se vean seleccionados y se puedan quitar.
export function vendorOptions(users: ConfigUser[], rows: VendorAssignRow[]): { value: string; label: string }[] {
  const userById = new Map(users.map((u) => [u.id, u]));
  const assignedIds = new Set(rows.flatMap((r) => r.assigned.map((p) => p.user_id)));
  const known = users
    .filter((u) => (u.role === "vendedor" && u.active) || assignedIds.has(u.id))
    .map((u) => ({
      value: u.id,
      label: !u.active ? `${u.full_name} (inactivo)` : u.role === "vendedor" ? u.full_name : `${u.full_name} (${roleLabel(u.role)})`,
    }));
  // Un user_id asignado que ya no existe en `users` (borrado) no tiene de dónde sacar
  // un label: se agrega una opción propia, para que el chip nunca muestre el UUID crudo.
  const ghosts = Array.from(assignedIds)
    .filter((id) => !userById.has(id))
    .map((id) => ({ value: id, label: "(usuario desconocido)" }));
  return [...known, ...ghosts].sort((a, b) => byName(a.label, b.label));
}

export function diffAssignments(current: string[], next: string[]): { toAdd: string[]; toRemove: string[] } {
  const cur = new Set(current);
  const nxt = new Set(next);
  return {
    toAdd: Array.from(nxt).filter((id) => !cur.has(id)),
    toRemove: Array.from(cur).filter((id) => !nxt.has(id)),
  };
}

export async function fetchVendorAssignmentData(): Promise<{ clients: ClientRow[]; assignments: AssignmentRow[]; users: ConfigUser[] }> {
  const sb = getSupabaseBrowser();
  const [clients, a, u] = await Promise.all([
    fetchClients(),
    sb.from("client_assignments").select("client_id, user_id"),
    sb.from("users").select("id, full_name, role, active").order("full_name"),
  ]);
  if (a.error) throw a.error;
  if (u.error) throw u.error;
  return {
    clients,
    assignments: (a.data ?? []) as AssignmentRow[],
    users: ((u.data ?? []) as { id: string; full_name: string | null; role: string; active: boolean }[])
      .map((x) => ({ id: x.id, full_name: x.full_name ?? "(sin nombre)", role: x.role, active: x.active })),
  };
}
