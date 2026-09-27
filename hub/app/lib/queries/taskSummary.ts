import type { FullTaskRow } from "./tasks";
import type { TaskAssignee } from "./assignments";
import { anomalyLabel } from "./visitDetail";
import {
  AGE_BUCKETS, AGE_BUCKET_LABEL, ANOMALIA_CUALQUIERA, LINEA_NINGUNA, VENDEDOR_NINGUNO,
  ageBucket, taskAnomalyCode, taskProducts,
  type AgeBucket, type TaskFilterOptions, type TaskFilterValue,
} from "./taskFilters";

export type VendorRow = {
  key: string; nombre: string; abiertas: number; completadas: number; porAntiguedad: Record<AgeBucket, number>;
};
export type RankRow = { key: string; label: string; n: number };
export type TaskSummary = {
  abiertas: number;
  porAntiguedad: Record<AgeBucket, number>;
  porVendedor: VendorRow[];
  topProductos: RankRow[];
  topLineas: RankRow[];
};

const emptyBuckets = (): Record<AgeBucket, number> => ({ "0-7": 0, "8-15": 0, "16-30": 0, "30+": 0 });

function rank(counts: Map<string, { label: string; n: number }>, limit: number): RankRow[] {
  return Array.from(counts, ([key, { label, n }]) => ({ key, label, n }))
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, "es"))
    .slice(0, limit);
}

// `tasks` ya viene filtrado con filterTasksForSummary (sin estado ni antigüedad).
export function summarizeTasks(
  tasks: FullTaskRow[], assignees: TaskAssignee[], opts: { today: string; vendedor?: string },
): TaskSummary {
  const vendedoresPorCliente = new Map<string, { key: string; nombre: string }[]>();
  for (const a of assignees) {
    const list = vendedoresPorCliente.get(a.client_id) ?? [];
    list.push({ key: a.user_id, nombre: a.full_name });
    vendedoresPorCliente.set(a.client_id, list);
  }

  const porAntiguedad = emptyBuckets();
  const filas = new Map<string, VendorRow>();
  const productos = new Map<string, { label: string; n: number }>();
  const lineas = new Map<string, { label: string; n: number }>();
  let abiertas = 0;

  for (const t of tasks) {
    const open = t.status === "open";
    const bucket = open ? ageBucket(t.created_at, opts.today) : null;
    if (open) { abiertas++; porAntiguedad[bucket!]++; }

    const vendedores = (t.client_id && vendedoresPorCliente.get(t.client_id)) || [{ key: VENDEDOR_NINGUNO, nombre: "Sin vendedor" }];
    for (const v of vendedores) {
      if (opts.vendedor && v.key !== opts.vendedor) continue;
      const fila = filas.get(v.key) ?? { key: v.key, nombre: v.nombre, abiertas: 0, completadas: 0, porAntiguedad: emptyBuckets() };
      if (open) { fila.abiertas++; fila.porAntiguedad[bucket!]++; } else { fila.completadas++; }
      filas.set(v.key, fila);
    }

    if (taskAnomalyCode(t.title) === "sin_stock") {
      const prods = taskProducts(t);
      for (const p of prods) {
        const c = productos.get(p.product_id) ?? { label: p.name, n: 0 };
        c.n++;
        productos.set(p.product_id, c);
      }
      // Una tarea suma una vez por línea aunque tenga varios productos de ella.
      const lineasDeLaTarea = new Set(prods.map((p) => p.line ?? LINEA_NINGUNA));
      for (const l of Array.from(lineasDeLaTarea)) {
        const c = lineas.get(l) ?? { label: l === LINEA_NINGUNA ? "Sin línea" : l, n: 0 };
        c.n++;
        lineas.set(l, c);
      }
    }
  }

  return {
    abiertas,
    porAntiguedad,
    porVendedor: Array.from(filas.values())
      .sort((a, b) => b.abiertas - a.abiertas || a.nombre.localeCompare(b.nombre, "es")),
    topProductos: rank(productos, 10),
    topLineas: rank(lineas, 10),
  };
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const corta = (ymd: string) => `${Number(ymd.slice(8, 10))}-${MESES[Number(ymd.slice(5, 7)) - 1]}`;
const labelOf = (list: { value: string; label: string }[], value: string) =>
  list.find((o) => o.value === value)?.label ?? value;

export function describeTaskFilter(v: TaskFilterValue, options: TaskFilterOptions, count: number): string {
  const estado = v.status === "open" ? (count === 1 ? " abierta" : " abiertas")
    : v.status === "resolved" ? (count === 1 ? " completada" : " completadas") : "";
  const partes = [`Mostrando ${count} ${count === 1 ? "tarea" : "tareas"}${estado}`];
  if (v.vendedor) partes.push(`vendedor ${v.vendedor === VENDEDOR_NINGUNO ? "Sin vendedor" : labelOf(options.vendedores, v.vendedor)}`);
  if (v.cliente) partes.push(`cliente ${labelOf(options.clientes, v.cliente)}`);
  if (v.anomalia) partes.push(v.anomalia === ANOMALIA_CUALQUIERA ? "de anomalías" : `anomalía ${anomalyLabel(v.anomalia)}`);
  if (v.producto) partes.push(`producto ${labelOf(options.productos, v.producto)}`);
  if (v.linea) partes.push(`línea ${v.linea === LINEA_NINGUNA ? "Sin línea" : v.linea}`);
  if (v.desde && v.hasta) partes.push(`creadas del ${corta(v.desde)} al ${corta(v.hasta)}`);
  else if (v.desde) partes.push(`creadas desde el ${corta(v.desde)}`);
  else if (v.hasta) partes.push(`creadas hasta el ${corta(v.hasta)}`);
  if (v.antiguedad.length > 0) partes.push(AGE_BUCKETS.filter((b) => v.antiguedad.includes(b)).map((b) => AGE_BUCKET_LABEL[b]).join(", "));
  return partes.join(" · ");
}
