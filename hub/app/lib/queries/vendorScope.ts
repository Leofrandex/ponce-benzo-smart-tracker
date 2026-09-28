import type { TaskAssignee } from "./assignments";

// Qué cadenas atiende un vendedor, según client_assignments (RLS: un vendedor
// solo ve las suyas). Compartido por Tareas, Tiendas, Clientes y Mapa.
export function clientesDeVendedor(assignments: TaskAssignee[], userId: string): Set<string> {
  return new Set(assignments.filter((a) => a.user_id === userId).map((a) => a.client_id));
}

export function tiendasDeVendedor<S extends { store_id: string; client_id: string | null }>(
  stores: S[], assignments: TaskAssignee[], userId: string,
): string[] {
  const clientes = clientesDeVendedor(assignments, userId);
  return stores.filter((s) => s.client_id && clientes.has(s.client_id)).map((s) => s.store_id);
}
