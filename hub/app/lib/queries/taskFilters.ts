import type { FullTaskRow } from "./tasks";
import type { TaskAssignee } from "./assignments";
import { EMPTY_GEO, type GeoFilterValue } from "@/app/components/geo/geoOptions";

// Filtro único de la pantalla de Tareas. Toda la lógica es pura para poder
// testearla sin React ni Supabase.
export type TaskFilterValue = {
  status: "open" | "resolved" | "all";
  geo: GeoFilterValue;
  vendedor: string; // user_id o "" (todos)
  cliente: string;  // client_id o ""
  tipo: string;     // task_type o ""
  texto: string;
};

export const EMPTY_TASK_FILTER: TaskFilterValue = {
  status: "all", geo: EMPTY_GEO, vendedor: "", cliente: "", tipo: "", texto: "",
};

export function normalizeText(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export const TASK_TYPE_LABEL: Record<string, string> = {
  reponer_stock:       "Reponer stock",
  contactar_comprador: "Contactar comprador",
  contactar_gerente:   "Contactar gerente",
  revisar_anomalia:    "Revisar anomalía",
};

export function taskTypeLabel(taskType: string): string {
  return TASK_TYPE_LABEL[taskType] ?? taskType.replace(/_/g, " ");
}

export type TaskFilterOptions = {
  vendedores: { value: string; label: string }[];
  clientes:   { value: string; label: string }[];
  tipos:      { value: string; label: string }[];
};

const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, "es");

export function deriveTaskFilterOptions(tasks: FullTaskRow[], assignees: TaskAssignee[]): TaskFilterOptions {
  const vend = new Map<string, string>();
  for (const a of assignees) vend.set(a.user_id, a.full_name);
  const cli = new Map<string, string>();
  for (const t of tasks) if (t.client_id) cli.set(t.client_id, t.client_name ?? "(sin nombre)");
  const tipos = new Set<string>(tasks.map((t) => t.task_type));
  return {
    vendedores: Array.from(vend, ([value, label]) => ({ value, label })).sort(byLabel),
    clientes:   Array.from(cli,  ([value, label]) => ({ value, label })).sort(byLabel),
    tipos:      Array.from(tipos, (value) => ({ value, label: taskTypeLabel(value) })).sort(byLabel),
  };
}

export function filterTasks(tasks: FullTaskRow[], value: TaskFilterValue, assignees: TaskAssignee[]): FullTaskRow[] {
  // Clientes del vendedor elegido; vacío = sin filtro por vendedor.
  const clientesDelVendedor = value.vendedor
    ? new Set(assignees.filter((a) => a.user_id === value.vendedor).map((a) => a.client_id))
    : null;
  const q = normalizeText(value.texto);

  return tasks.filter((t) => {
    if (value.status !== "all" && t.status !== value.status) return false;
    if (value.geo.estado && t.estado !== value.geo.estado) return false;
    if (value.geo.municipio && t.municipio !== value.geo.municipio) return false;
    if (value.geo.urbanizacion && t.urbanizacion !== value.geo.urbanizacion) return false;
    if (clientesDelVendedor && (!t.client_id || !clientesDelVendedor.has(t.client_id))) return false;
    if (value.cliente && t.client_id !== value.cliente) return false;
    if (value.tipo && t.task_type !== value.tipo) return false;
    if (q) {
      const hay = [t.store_name, t.title, t.description].some((s) => normalizeText(s).includes(q));
      if (!hay) return false;
    }
    return true;
  });
}

export function hasActiveFilters(value: TaskFilterValue): boolean {
  return (
    value.status !== "all" ||
    !!value.geo.estado || !!value.geo.municipio || !!value.geo.urbanizacion ||
    !!value.vendedor || !!value.cliente || !!value.tipo ||
    value.texto.trim() !== ""
  );
}
