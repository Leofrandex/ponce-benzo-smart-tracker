import type { FullTaskRow } from "./tasks";
import type { TaskAssignee } from "./assignments";
import { clientesDeVendedor } from "./vendorScope";
import { anomalyLabel } from "./visitDetail";
import { EMPTY_GEO, type GeoFilterValue } from "@/app/components/geo/geoOptions";

export type AgeBucket = "0-7" | "8-15" | "16-30" | "30+";
export const AGE_BUCKETS: AgeBucket[] = ["0-7", "8-15", "16-30", "30+"];
export const AGE_BUCKET_LABEL: Record<AgeBucket, string> = {
  "0-7": "0–7 días", "8-15": "8–15 días", "16-30": "16–30 días", "30+": "Más de 30 días",
};

// Valores especiales de los selects.
export const VENDEDOR_NINGUNO = "sin-vendedor";
export const ANOMALIA_CUALQUIERA = "cualquiera";
export const LINEA_NINGUNA = "sin_linea";

// Filtro único de la pantalla de Tareas. Toda la lógica es pura para poder
// testearla sin React ni Supabase. La URL es su fuente (ver taskUrl.ts).
export type TaskFilterValue = {
  status: "open" | "resolved" | "all";
  geo: GeoFilterValue;
  vendedor: string;   // user_id, VENDEDOR_NINGUNO o "" (todos)
  cliente: string;    // client_id o ""
  tipo: string;       // task_type o ""
  texto: string;
  anomalia: string;   // código de anomalía, ANOMALIA_CUALQUIERA o ""
  producto: string;   // product_id o ""
  linea: string;      // products.line, LINEA_NINGUNA o ""
  desde: string;      // 'YYYY-MM-DD' (fecha de creación en Caracas) o ""
  hasta: string;
  antiguedad: AgeBucket[]; // solo aplica a abiertas; vacío = sin filtro
};

// Sin ningún filtro (incluye completadas).
export const EMPTY_TASK_FILTER: TaskFilterValue = {
  status: "all", geo: EMPTY_GEO, vendedor: "", cliente: "", tipo: "", texto: "",
  anomalia: "", producto: "", linea: "", desde: "", hasta: "", antiguedad: [],
};

// Lo que ve quien entra a /panel/tareas sin parámetros.
export const DEFAULT_TASK_FILTER: TaskFilterValue = { ...EMPTY_TASK_FILTER, status: "open" };

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

// El trigger que crea tareas desde anomalías titula "Anomalía: <código>" (ej. sin_stock).
const ANOMALY_TITLE = /^Anomalía:\s*(\S+)$/;

export function taskAnomalyCode(title: string | null): string | null {
  const m = title?.match(ANOMALY_TITLE);
  return m ? m[1] : null;
}

export function taskTitleLabel(title: string): string {
  const code = taskAnomalyCode(title);
  return code ? `Anomalía: ${anomalyLabel(code)}` : title;
}

// Fechas "de calendario" del equipo: siempre America/Caracas, igual que
// fn_fecha_local / fn_hoy en la base.
const FMT_CARACAS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Caracas", year: "numeric", month: "2-digit", day: "2-digit",
});

export function fechaCaracas(isoTs: string): string {
  return FMT_CARACAS.format(new Date(isoTs));
}

export function hoyCaracas(): string {
  return FMT_CARACAS.format(new Date());
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(hasta + "T00:00:00Z") - Date.parse(desde + "T00:00:00Z")) / 86400000);
}

// Mismos cortes que fn_dash_backlog_tareas.
export function ageBucket(createdAt: string, today: string): AgeBucket {
  const d = diasEntre(fechaCaracas(createdAt), today);
  if (d <= 7) return "0-7";
  if (d <= 15) return "8-15";
  if (d <= 30) return "16-30";
  return "30+";
}

export type TaskProduct = { product_id: string; name: string; brand: string | null; line: string | null };

export function taskProducts(t: FullTaskRow): TaskProduct[] {
  const code = taskAnomalyCode(t.title);
  if (!code) return [];
  return t.anomaly_products
    .filter((p) => p.anomaly_type === code)
    .map((p) => ({ product_id: p.product_id, name: p.name, brand: p.brand, line: p.line }));
}

// Tareas de una tienda para su ficha: abiertas primero, más recientes arriba.
export function tasksForStore(tasks: FullTaskRow[], storeId: string): FullTaskRow[] {
  return tasks
    .filter((t) => t.store_id === storeId)
    .sort((a, b) =>
      a.status !== b.status ? (a.status === "open" ? -1 : 1) : b.created_at.localeCompare(a.created_at),
    );
}

export type TaskFilterOptions = {
  vendedores: { value: string; label: string }[];
  clientes:   { value: string; label: string }[];
  tipos:      { value: string; label: string }[];
  anomalias:  { value: string; label: string }[];
  productos:  { value: string; label: string }[];
  lineas:     { value: string; label: string }[];
};

const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, "es");

export function deriveTaskFilterOptions(tasks: FullTaskRow[], assignees: TaskAssignee[]): TaskFilterOptions {
  const vend = new Map<string, string>();
  for (const a of assignees) vend.set(a.user_id, a.full_name);
  const cli = new Map<string, string>();
  const codes = new Set<string>();
  const prods = new Map<string, string>();
  const lines = new Set<string>();
  let hasNoLine = false;
  for (const t of tasks) {
    if (t.client_id) cli.set(t.client_id, t.client_name ?? "(sin nombre)");
    const code = taskAnomalyCode(t.title);
    if (code) codes.add(code);
    for (const p of taskProducts(t)) {
      prods.set(p.product_id, p.name);
      if (p.line) lines.add(p.line); else hasNoLine = true;
    }
  }
  const tipos = new Set<string>(tasks.map((t) => t.task_type));
  return {
    vendedores: Array.from(vend, ([value, label]) => ({ value, label })).sort(byLabel),
    clientes:   Array.from(cli,  ([value, label]) => ({ value, label })).sort(byLabel),
    tipos:      Array.from(tipos, (value) => ({ value, label: taskTypeLabel(value) })).sort(byLabel),
    anomalias:  [
      { value: ANOMALIA_CUALQUIERA, label: "Cualquier anomalía" },
      ...Array.from(codes, (value) => ({ value, label: anomalyLabel(value) })).sort(byLabel),
    ],
    productos:  Array.from(prods, ([value, label]) => ({ value, label })).sort(byLabel),
    lineas:     [
      ...Array.from(lines, (value) => ({ value, label: value })).sort(byLabel),
      ...(hasNoLine ? [{ value: LINEA_NINGUNA, label: "Sin línea" }] : []),
    ],
  };
}

export function filterTasks(
  tasks: FullTaskRow[], value: TaskFilterValue, assignees: TaskAssignee[], today: string = hoyCaracas(),
): FullTaskRow[] {
  const clientesConVendedor = new Set(assignees.map((a) => a.client_id));
  // Clientes del vendedor elegido; null = sin filtro por un vendedor concreto.
  const clientesDelVendedor = value.vendedor && value.vendedor !== VENDEDOR_NINGUNO
    ? clientesDeVendedor(assignees, value.vendedor)
    : null;
  const q = normalizeText(value.texto);

  return tasks.filter((t) => {
    if (value.status !== "all" && t.status !== value.status) return false;
    if (value.geo.estado && t.estado !== value.geo.estado) return false;
    if (value.geo.municipio && t.municipio !== value.geo.municipio) return false;
    if (value.geo.urbanizacion && t.urbanizacion !== value.geo.urbanizacion) return false;
    if (clientesDelVendedor && (!t.client_id || !clientesDelVendedor.has(t.client_id))) return false;
    if (value.vendedor === VENDEDOR_NINGUNO && t.client_id && clientesConVendedor.has(t.client_id)) return false;
    if (value.cliente && t.client_id !== value.cliente) return false;
    if (value.tipo && t.task_type !== value.tipo) return false;
    if (value.anomalia) {
      const code = taskAnomalyCode(t.title);
      if (!code) return false;
      if (value.anomalia !== ANOMALIA_CUALQUIERA && code !== value.anomalia) return false;
    }
    if (value.producto || value.linea) {
      const prods = taskProducts(t);
      if (value.producto && !prods.some((p) => p.product_id === value.producto)) return false;
      if (value.linea === LINEA_NINGUNA && !prods.some((p) => !p.line)) return false;
      if (value.linea && value.linea !== LINEA_NINGUNA && !prods.some((p) => p.line === value.linea)) return false;
    }
    if (value.desde || value.hasta) {
      const f = fechaCaracas(t.created_at);
      if (value.desde && f < value.desde) return false;
      if (value.hasta && f > value.hasta) return false;
    }
    if (value.antiguedad.length > 0) {
      if (t.status !== "open") return false;
      if (!value.antiguedad.includes(ageBucket(t.created_at, today))) return false;
    }
    if (q) {
      const hay = [t.store_name, t.title, t.description].some((s) => normalizeText(s).includes(q));
      if (!hay) return false;
    }
    return true;
  });
}

// Conjunto sobre el que se calcula el resumen: todos los filtros menos estado
// y antigüedad, para poder mostrar el reparto completo de ambos.
export function filterTasksForSummary(
  tasks: FullTaskRow[], value: TaskFilterValue, assignees: TaskAssignee[], today: string = hoyCaracas(),
): FullTaskRow[] {
  return filterTasks(tasks, { ...value, status: "all", antiguedad: [] }, assignees, today);
}

// El estado tiene sus propios chips; esto responde "¿hay algo que limpiar?".
export function hasActiveFilters(value: TaskFilterValue): boolean {
  return (
    !!value.geo.estado || !!value.geo.municipio || !!value.geo.urbanizacion ||
    !!value.vendedor || !!value.cliente || !!value.tipo ||
    value.texto.trim() !== "" ||
    !!value.anomalia || !!value.producto || !!value.linea ||
    !!value.desde || !!value.hasta || value.antiguedad.length > 0
  );
}
