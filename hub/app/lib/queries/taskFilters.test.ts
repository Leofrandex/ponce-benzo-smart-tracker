import { test } from "node:test";
import assert from "node:assert/strict";
import type { FullTaskRow } from "./tasks";
import type { TaskAssignee } from "./assignments";
import {
  EMPTY_TASK_FILTER, DEFAULT_TASK_FILTER, normalizeText, taskTypeLabel,
  deriveTaskFilterOptions, filterTasks, filterTasksForSummary, hasActiveFilters, tasksForStore, taskTitleLabel,
  fechaCaracas, ageBucket, taskAnomalyCode, taskProducts,
  VENDEDOR_NINGUNO, ANOMALIA_CUALQUIERA, LINEA_NINGUNA,
} from "./taskFilters";

const task = (over: Partial<FullTaskRow>): FullTaskRow => ({
  task_id: "t", store_id: "s", store_name: "FTD CENTRO", client_id: "c1", client_name: "FARMATODO",
  estado: "Distrito Capital", municipio: "Libertador", urbanizacion: null,
  created_by_name: "Elvis", task_type: "reponer_stock", title: "Anomalía: sin_stock",
  description: null, status: "open", created_at: "2026-09-01T10:00:00Z",
  assignee_user_id: null, source_visit_id: null,
  resolution_note: null, resolution_note_at: null, resolution_note_by_name: null, anomaly_products: [],
  ...over,
});

const assignees: TaskAssignee[] = [
  { user_id: "u-betsy", full_name: "Betsy Castro", client_id: "c1" },
  { user_id: "u-juan",  full_name: "Juan León",    client_id: "c2" },
  { user_id: "u-betsy", full_name: "Betsy Castro", client_id: "c2" },
];

const tasks = [
  task({ task_id: "t1", client_id: "c1", client_name: "FARMATODO" }),
  task({ task_id: "t2", client_id: "c2", client_name: "LOCATEL", store_name: "LOCATEL LA CASTELLANA",
         task_type: "contactar_gerente", status: "resolved", description: "Producto dañado en anaquel" }),
  task({ task_id: "t3", client_id: null, client_name: null, store_id: null, store_name: null, title: "Llamar comprador" }),
];

test("normalizeText quita acentos y mayúsculas", () => {
  assert.equal(normalizeText("Anomalía: DAÑADO"), "anomalia: danado");
  assert.equal(normalizeText(null), "");
});

test("taskTypeLabel usa la etiqueta conocida o reemplaza guiones bajos", () => {
  assert.equal(taskTypeLabel("reponer_stock"), "Reponer stock");
  assert.equal(taskTypeLabel("otra_cosa_rara"), "otra cosa rara");
});

test("deriveTaskFilterOptions: vendedores únicos ordenados, clientes y tipos de las tareas", () => {
  const o = deriveTaskFilterOptions(tasks, assignees);
  assert.deepEqual(o.vendedores, [
    { value: "u-betsy", label: "Betsy Castro" },
    { value: "u-juan",  label: "Juan León" },
  ]);
  assert.deepEqual(o.clientes, [
    { value: "c1", label: "FARMATODO" },
    { value: "c2", label: "LOCATEL" },
  ]);
  assert.deepEqual(o.tipos, [
    { value: "contactar_gerente", label: "Contactar gerente" },
    { value: "reponer_stock",     label: "Reponer stock" },
  ]);
});

test("deriveTaskFilterOptions: dos asignados distintos con el mismo nombre no se colapsan", () => {
  const dupNombre: TaskAssignee[] = [
    { user_id: "u-1", full_name: "María Pérez", client_id: "c1" },
    { user_id: "u-2", full_name: "María Pérez", client_id: "c2" },
  ];
  const o = deriveTaskFilterOptions(tasks, dupNombre);
  assert.deepEqual(o.vendedores, [
    { value: "u-1", label: "María Pérez" },
    { value: "u-2", label: "María Pérez" },
  ]);
});

test("deriveTaskFilterOptions: cliente sin nombre usa el fallback '(sin nombre)'", () => {
  const o = deriveTaskFilterOptions([task({ task_id: "t4", client_id: "c9", client_name: null })], assignees);
  assert.deepEqual(o.clientes.find((c) => c.value === "c9"), { value: "c9", label: "(sin nombre)" });
});

test("filterTasks sin filtros devuelve todo", () => {
  assert.equal(filterTasks(tasks, EMPTY_TASK_FILTER, assignees).length, 3);
});

test("filterTasks por vendedor usa las asignaciones del cliente y excluye tareas sin cliente", () => {
  const juan = filterTasks(tasks, { ...EMPTY_TASK_FILTER, vendedor: "u-juan" }, assignees);
  assert.deepEqual(juan.map((t) => t.task_id), ["t2"]);
  const betsy = filterTasks(tasks, { ...EMPTY_TASK_FILTER, vendedor: "u-betsy" }, assignees);
  assert.deepEqual(betsy.map((t) => t.task_id), ["t1", "t2"]);
});

test("filterTasks por cliente, tipo y estado", () => {
  assert.deepEqual(filterTasks(tasks, { ...EMPTY_TASK_FILTER, cliente: "c1" }, assignees).map((t) => t.task_id), ["t1"]);
  assert.deepEqual(filterTasks(tasks, { ...EMPTY_TASK_FILTER, tipo: "contactar_gerente" }, assignees).map((t) => t.task_id), ["t2"]);
  assert.deepEqual(filterTasks(tasks, { ...EMPTY_TASK_FILTER, status: "resolved" }, assignees).map((t) => t.task_id), ["t2"]);
});

test("filterTasks por texto busca en tienda, título y descripción sin acentos", () => {
  assert.deepEqual(filterTasks(tasks, { ...EMPTY_TASK_FILTER, texto: "castellana" }, assignees).map((t) => t.task_id), ["t2"]);
  assert.deepEqual(filterTasks(tasks, { ...EMPTY_TASK_FILTER, texto: "DANADO" }, assignees).map((t) => t.task_id), ["t2"]);
  assert.deepEqual(filterTasks(tasks, { ...EMPTY_TASK_FILTER, texto: "llamar" }, assignees).map((t) => t.task_id), ["t3"]);
});

test("filterTasks combina filtros con AND, incluida geografía", () => {
  const r = filterTasks(tasks, { ...EMPTY_TASK_FILTER, vendedor: "u-betsy", status: "open",
    geo: { estado: "Distrito Capital", municipio: "", urbanizacion: "" } }, assignees);
  assert.deepEqual(r.map((t) => t.task_id), ["t1"]);
});

test("hasActiveFilters ignora el estado (tiene sus chips) y detecta cualquier otro filtro", () => {
  assert.equal(hasActiveFilters(EMPTY_TASK_FILTER), false);
  assert.equal(hasActiveFilters(DEFAULT_TASK_FILTER), false);
  assert.equal(hasActiveFilters({ ...EMPTY_TASK_FILTER, status: "open" }), false);
  assert.equal(hasActiveFilters({ ...EMPTY_TASK_FILTER, texto: " " }), false);
  assert.equal(hasActiveFilters({ ...EMPTY_TASK_FILTER, geo: { estado: "Lara", municipio: "", urbanizacion: "" } }), true);
  assert.equal(hasActiveFilters({ ...EMPTY_TASK_FILTER, anomalia: "sin_stock" }), true);
  assert.equal(hasActiveFilters({ ...EMPTY_TASK_FILTER, antiguedad: ["0-7"] }), true);
  assert.equal(hasActiveFilters({ ...EMPTY_TASK_FILTER, desde: "2026-09-01" }), true);
});

test("tasksForStore filtra por tienda y pone las abiertas primero, más recientes arriba", () => {
  const all = [
    task({ task_id: "a", store_id: "s1", status: "resolved", created_at: "2026-09-25T10:00:00Z" }),
    task({ task_id: "b", store_id: "s1", status: "open",     created_at: "2026-09-20T10:00:00Z" }),
    task({ task_id: "c", store_id: "s2", status: "open",     created_at: "2026-09-25T12:00:00Z" }),
    task({ task_id: "d", store_id: "s1", status: "open",     created_at: "2026-09-24T10:00:00Z" }),
  ];
  assert.deepEqual(tasksForStore(all, "s1").map((t) => t.task_id), ["d", "b", "a"]);
  assert.deepEqual(tasksForStore(all, "zz"), []);
});

test("taskTitleLabel traduce los códigos de anomalía del título", () => {
  assert.equal(taskTitleLabel("Anomalía: sin_stock"), "Anomalía: Sin stock");
  assert.equal(taskTitleLabel("Anomalía: producto_danado"), "Anomalía: Producto dañado");
  assert.equal(taskTitleLabel("Anomalía: codigo_nuevo"), "Anomalía: codigo nuevo");
  assert.equal(taskTitleLabel("Llamar al comprador"), "Llamar al comprador");
});

const prod = (over: Partial<{ anomaly_type: string; product_id: string; name: string; brand: string | null; line: string | null }>) => ({
  anomaly_type: "sin_stock", product_id: "p1", name: "WAMPOLE FRESA", brand: "WAMPOLE", line: "Vitaminas", ...over,
});

test("fechaCaracas usa la fecha de Caracas, no la UTC", () => {
  // 02:30 UTC del 26-sep = 22:30 del 25-sep en Caracas (UTC-4).
  assert.equal(fechaCaracas("2026-09-26T02:30:00Z"), "2026-09-25");
  assert.equal(fechaCaracas("2026-09-26T04:00:00Z"), "2026-09-26");
});

test("ageBucket replica los cortes de fn_dash_backlog_tareas", () => {
  const hoy = "2026-09-26";
  assert.equal(ageBucket("2026-09-26T15:00:00Z", hoy), "0-7");
  assert.equal(ageBucket("2026-09-19T15:00:00Z", hoy), "0-7");   // 7 días
  assert.equal(ageBucket("2026-09-18T15:00:00Z", hoy), "8-15");  // 8 días
  assert.equal(ageBucket("2026-09-11T15:00:00Z", hoy), "8-15");  // 15 días
  assert.equal(ageBucket("2026-09-10T15:00:00Z", hoy), "16-30"); // 16 días
  assert.equal(ageBucket("2026-08-27T15:00:00Z", hoy), "16-30"); // 30 días
  assert.equal(ageBucket("2026-08-26T15:00:00Z", hoy), "30+");   // 31 días
  // De noche en Caracas: 02:30 UTC del 19-sep es el 18-sep local → 8 días.
  assert.equal(ageBucket("2026-09-19T02:30:00Z", hoy), "8-15");
});

test("taskAnomalyCode lee el código del título generado por el trigger", () => {
  assert.equal(taskAnomalyCode("Anomalía: sin_stock"), "sin_stock");
  assert.equal(taskAnomalyCode("Anomalía:   diferencia_precios"), "diferencia_precios");
  assert.equal(taskAnomalyCode("Llamar comprador"), null);
  assert.equal(taskAnomalyCode(null), null);
});

test("taskProducts se queda solo con los productos del tipo de anomalía de la tarea", () => {
  const t = task({
    title: "Anomalía: sin_stock",
    anomaly_products: [prod({ product_id: "p1" }), prod({ product_id: "p2", anomaly_type: "producto_danado" })],
  });
  assert.deepEqual(taskProducts(t).map((p) => p.product_id), ["p1"]);
  assert.deepEqual(taskProducts(task({ title: "Llamar comprador", anomaly_products: [prod({})] })), []);
});

test("filterTasks por anomalía: código concreto y 'cualquiera'", () => {
  const ts = [
    task({ task_id: "a", title: "Anomalía: sin_stock" }),
    task({ task_id: "b", title: "Anomalía: diferencia_precios" }),
    task({ task_id: "c", title: "Llamar comprador" }),
  ];
  assert.deepEqual(filterTasks(ts, { ...EMPTY_TASK_FILTER, anomalia: "sin_stock" }, assignees).map((t) => t.task_id), ["a"]);
  assert.deepEqual(filterTasks(ts, { ...EMPTY_TASK_FILTER, anomalia: ANOMALIA_CUALQUIERA }, assignees).map((t) => t.task_id), ["a", "b"]);
});

test("filterTasks por producto y por línea (incluida 'sin línea')", () => {
  const ts = [
    task({ task_id: "a", anomaly_products: [prod({ product_id: "p1", line: "Vitaminas" })] }),
    task({ task_id: "b", anomaly_products: [prod({ product_id: "p2", line: null })] }),
    task({ task_id: "c", anomaly_products: [] }),
  ];
  assert.deepEqual(filterTasks(ts, { ...EMPTY_TASK_FILTER, producto: "p2" }, assignees).map((t) => t.task_id), ["b"]);
  assert.deepEqual(filterTasks(ts, { ...EMPTY_TASK_FILTER, linea: "Vitaminas" }, assignees).map((t) => t.task_id), ["a"]);
  assert.deepEqual(filterTasks(ts, { ...EMPTY_TASK_FILTER, linea: LINEA_NINGUNA }, assignees).map((t) => t.task_id), ["b"]);
});

test("filterTasks por periodo compara la fecha de Caracas, extremos inclusivos", () => {
  const ts = [
    task({ task_id: "noche", created_at: "2026-09-26T02:30:00Z" }), // 25-sep en Caracas
    task({ task_id: "dia",   created_at: "2026-09-26T15:00:00Z" }), // 26-sep
    task({ task_id: "antes", created_at: "2026-09-18T15:00:00Z" }),
  ];
  const r = filterTasks(ts, { ...EMPTY_TASK_FILTER, desde: "2026-09-19", hasta: "2026-09-25" }, assignees);
  assert.deepEqual(r.map((t) => t.task_id), ["noche"]);
});

test("filterTasks por antigüedad solo deja abiertas del tramo", () => {
  const ts = [
    task({ task_id: "nueva",   status: "open",     created_at: "2026-09-25T15:00:00Z" }),
    task({ task_id: "vieja",   status: "open",     created_at: "2026-08-01T15:00:00Z" }),
    task({ task_id: "cerrada", status: "resolved", created_at: "2026-08-01T15:00:00Z" }),
  ];
  const r = filterTasks(ts, { ...EMPTY_TASK_FILTER, antiguedad: ["30+"] }, assignees, "2026-09-26");
  assert.deepEqual(r.map((t) => t.task_id), ["vieja"]);
});

test("filterTasks con vendedor 'sin-vendedor' deja tareas de cadenas sin asignar o sin cadena", () => {
  const ts = [
    task({ task_id: "c1", client_id: "c1" }),   // c1 tiene a Betsy
    task({ task_id: "c9", client_id: "c9" }),   // c9 sin asignaciones
    task({ task_id: "nul", client_id: null }),
  ];
  const r = filterTasks(ts, { ...EMPTY_TASK_FILTER, vendedor: VENDEDOR_NINGUNO }, assignees);
  assert.deepEqual(r.map((t) => t.task_id), ["c9", "nul"]);
});

test("filterTasksForSummary ignora estado y antigüedad pero respeta el resto", () => {
  const ts = [
    task({ task_id: "a", status: "resolved", client_id: "c1" }),
    task({ task_id: "b", status: "open", client_id: "c2" }),
  ];
  const v = { ...DEFAULT_TASK_FILTER, cliente: "c1", antiguedad: ["0-7" as const] };
  assert.deepEqual(filterTasksForSummary(ts, v, assignees, "2026-09-26").map((t) => t.task_id), ["a"]);
});

test("deriveTaskFilterOptions incluye anomalías, productos y líneas presentes", () => {
  const ts = [
    task({ title: "Anomalía: sin_stock", anomaly_products: [prod({ product_id: "p1", name: "WAMPOLE FRESA", line: "Vitaminas" })] }),
    task({ title: "Anomalía: diferencia_precios", anomaly_products: [prod({ anomaly_type: "diferencia_precios", product_id: "p2", name: "DIOXOGEN 120", line: null })] }),
  ];
  const o = deriveTaskFilterOptions(ts, assignees);
  assert.deepEqual(o.anomalias, [
    { value: ANOMALIA_CUALQUIERA, label: "Cualquier anomalía" },
    { value: "diferencia_precios", label: "Diferencia de precios" },
    { value: "sin_stock", label: "Sin stock" },
  ]);
  assert.deepEqual(o.productos, [
    { value: "p2", label: "DIOXOGEN 120" },
    { value: "p1", label: "WAMPOLE FRESA" },
  ]);
  assert.deepEqual(o.lineas, [
    { value: "Vitaminas", label: "Vitaminas" },
    { value: LINEA_NINGUNA, label: "Sin línea" },
  ]);
});
