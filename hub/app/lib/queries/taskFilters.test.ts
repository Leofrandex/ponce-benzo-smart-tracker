import { test } from "node:test";
import assert from "node:assert/strict";
import type { FullTaskRow } from "./tasks";
import type { TaskAssignee } from "./assignments";
import {
  EMPTY_TASK_FILTER, normalizeText, taskTypeLabel,
  deriveTaskFilterOptions, filterTasks, hasActiveFilters,
} from "./taskFilters";

const task = (over: Partial<FullTaskRow>): FullTaskRow => ({
  task_id: "t", store_id: "s", store_name: "FTD CENTRO", client_id: "c1", client_name: "FARMATODO",
  estado: "Distrito Capital", municipio: "Libertador", urbanizacion: null,
  created_by_name: "Elvis", task_type: "reponer_stock", title: "Anomalía: sin_stock",
  description: null, status: "open", created_at: "2026-09-01T10:00:00Z",
  assignee_user_id: null, source_visit_id: null,
  resolution_note: null, resolution_note_at: null, resolution_note_by_name: null,
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

test("hasActiveFilters ignora el estado 'all' y detecta cualquier otro filtro", () => {
  assert.equal(hasActiveFilters(EMPTY_TASK_FILTER), false);
  assert.equal(hasActiveFilters({ ...EMPTY_TASK_FILTER, status: "open" }), true);
  assert.equal(hasActiveFilters({ ...EMPTY_TASK_FILTER, texto: " " }), false);
  assert.equal(hasActiveFilters({ ...EMPTY_TASK_FILTER, geo: { estado: "Lara", municipio: "", urbanizacion: "" } }), true);
});
