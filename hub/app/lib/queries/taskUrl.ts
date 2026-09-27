import { AGE_BUCKETS, DEFAULT_TASK_FILTER, type AgeBucket, type TaskFilterValue } from "./taskFilters";

// La URL es la fuente de los filtros de Tareas: así el dashboard, el perfil y
// la ficha pueden enlazar a una vista ya filtrada, y un enlace se comparte.

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function validYmd(s: string): string {
  if (!YMD.test(s)) return "";
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : "";
}

// "30+" pegado en un chat llega como "30 " (el + de la query es un espacio).
const BUCKET_ALIASES: Record<string, AgeBucket> = {
  "0-7": "0-7", "8-15": "8-15", "16-30": "16-30", "30+": "30+", "+30": "30+", "30": "30+",
};

function parseAntiguedad(raw: string): AgeBucket[] {
  const found = new Set<AgeBucket>();
  for (const part of raw.split(",")) {
    const b = BUCKET_ALIASES[part.trim()];
    if (b) found.add(b);
  }
  return AGE_BUCKETS.filter((b) => found.has(b));
}

export function parseTaskParams(p: URLSearchParams): TaskFilterValue {
  const g = (k: string) => (p.get(k) ?? "").trim();
  const estado = g("estado");
  const status: TaskFilterValue["status"] =
    estado === "open" || estado === "resolved" || estado === "all" ? estado
    // Un enlace directo a una tarea no debe esconderla si ya está completada.
    : p.has("task") ? "all"
    : DEFAULT_TASK_FILTER.status;
  return {
    status,
    geo: { estado: g("estado_geo"), municipio: g("municipio"), urbanizacion: g("urbanizacion") },
    vendedor: g("vendedor"),
    cliente: g("cliente"),
    tipo: g("tipo"),
    texto: p.get("q") ?? "",
    anomalia: g("anomalia"),
    producto: g("producto"),
    linea: g("linea"),
    desde: validYmd(g("desde")),
    hasta: validYmd(g("hasta")),
    antiguedad: parseAntiguedad(g("antiguedad")),
  };
}

export function serializeTaskParams(v: TaskFilterValue, task?: string | null): string {
  const out = new URLSearchParams();
  // Con tarea enlazada el estado se escribe siempre: si se omitiera, al volver
  // a leer la URL se interpretaría como "all".
  if (v.status !== DEFAULT_TASK_FILTER.status || task) out.set("estado", v.status);
  const set = (k: string, val: string) => { if (val) out.set(k, val); };
  set("vendedor", v.vendedor);
  set("cliente", v.cliente);
  set("estado_geo", v.geo.estado);
  set("municipio", v.geo.municipio);
  set("urbanizacion", v.geo.urbanizacion);
  set("tipo", v.tipo);
  set("q", v.texto);
  set("anomalia", v.anomalia);
  set("producto", v.producto);
  set("linea", v.linea);
  set("desde", v.desde);
  set("hasta", v.hasta);
  if (v.antiguedad.length > 0) out.set("antiguedad", v.antiguedad.join(","));
  if (task) out.set("task", task);
  return out.toString();
}
