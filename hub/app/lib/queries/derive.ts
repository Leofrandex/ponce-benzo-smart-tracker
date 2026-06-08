import type { Store, ContactListItem } from "../types";

// Filas crudas (subconjunto de columnas reales que necesitan los derivados).
export interface VisitRow {
  visit_id: string;
  store_id: string;
  check_in_time: string;
  status: "completed" | "skipped" | "anomaly";
}
export interface TaskRow {
  task_id: string;
  store_id: string | null;
  status: "open" | "resolved";
}

// Fila de la tabla de Clientes: Store + métricas derivadas.
export type ClientRow = Store & {
  last_visit_date: string | null;
  last_visit_status: "completed" | "skipped" | "anomaly" | null;
  pending_tasks: number;
};

export function deriveClientRows(
  stores: Store[],
  visits: VisitRow[],
  tasks: TaskRow[],
): ClientRow[] {
  // Última visita por tienda.
  const lastByStore = new Map<string, VisitRow>();
  for (const v of visits) {
    const cur = lastByStore.get(v.store_id);
    if (!cur || new Date(v.check_in_time) > new Date(cur.check_in_time)) lastByStore.set(v.store_id, v);
  }
  // Tareas abiertas por tienda.
  const openByStore = new Map<string, number>();
  for (const t of tasks) {
    if (t.status !== "open" || !t.store_id) continue;
    openByStore.set(t.store_id, (openByStore.get(t.store_id) ?? 0) + 1);
  }
  return stores.map((s) => {
    const last = lastByStore.get(s.store_id) ?? null;
    return {
      ...s,
      last_visit_date: last?.check_in_time ?? null,
      last_visit_status: last?.status ?? null,
      pending_tasks: openByStore.get(s.store_id) ?? 0,
    };
  });
}

export interface DashboardStats {
  totalVisits: number;
  totalAnomalies: number;
  resolvedTasks: number;
}

export function deriveDashboard(
  visits: VisitRow[],
  tasks: TaskRow[],
  cutoffMs: number,
): DashboardStats {
  const inRange = visits.filter((v) => new Date(v.check_in_time).getTime() >= cutoffMs);
  return {
    totalVisits: inRange.length,
    totalAnomalies: inRange.filter((v) => v.status === "anomaly").length,
    resolvedTasks: tasks.filter((t) => t.status === "resolved").length,
  };
}

// Re-export de tipo para conveniencia de los consumidores.
export type { ContactListItem };
