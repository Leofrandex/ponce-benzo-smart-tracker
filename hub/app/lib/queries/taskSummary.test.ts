import { test } from "node:test";
import assert from "node:assert/strict";
import type { FullTaskRow } from "./tasks";
import type { TaskAssignee } from "./assignments";
import { summarizeTasks, describeTaskFilter } from "./taskSummary";
import { DEFAULT_TASK_FILTER, EMPTY_TASK_FILTER, VENDEDOR_NINGUNO, LINEA_NINGUNA, type TaskFilterOptions } from "./taskFilters";

const task = (over: Partial<FullTaskRow>): FullTaskRow => ({
  task_id: "t", store_id: "s", store_name: "FTD CENTRO", client_id: "c1", client_name: "FARMATODO",
  estado: null, municipio: null, urbanizacion: null,
  created_by_name: "Elvis", task_type: "reponer_stock", title: "Anomalía: sin_stock",
  description: null, status: "open", created_at: "2026-09-25T15:00:00Z",
  assignee_user_id: null, source_visit_id: null,
  resolution_note: null, resolution_note_at: null, resolution_note_by_name: null, anomaly_products: [],
  ...over,
});
const prod = (id: string, name: string, line: string | null) =>
  ({ anomaly_type: "sin_stock", product_id: id, name, brand: null, line });

const assignees: TaskAssignee[] = [
  { user_id: "u-betsy",   full_name: "Betsy Castro",   client_id: "c1" },
  { user_id: "u-andreina", full_name: "Andreina Rangel", client_id: "c1" },
  { user_id: "u-juan",    full_name: "Juan León",      client_id: "c2" },
];
const HOY = "2026-09-26";

test("summarizeTasks: abiertas y reparto por antigüedad", () => {
  const s = summarizeTasks([
    task({ task_id: "a", created_at: "2026-09-25T15:00:00Z" }),
    task({ task_id: "b", created_at: "2026-09-01T15:00:00Z" }),
    task({ task_id: "c", created_at: "2026-07-01T15:00:00Z" }),
    task({ task_id: "d", created_at: "2026-07-01T15:00:00Z", status: "resolved" }),
  ], assignees, { today: HOY });
  assert.equal(s.abiertas, 3);
  assert.deepEqual(s.porAntiguedad, { "0-7": 1, "8-15": 0, "16-30": 1, "30+": 1 });
});

test("summarizeTasks: una tarea cuenta para cada vendedor de su cadena; sin cadena asignada va a 'Sin vendedor'", () => {
  const s = summarizeTasks([
    task({ task_id: "a", client_id: "c1" }),
    task({ task_id: "b", client_id: "c1", status: "resolved" }),
    task({ task_id: "c", client_id: "c9" }),
    task({ task_id: "d", client_id: null }),
  ], assignees, { today: HOY });
  const byKey = Object.fromEntries(s.porVendedor.map((r) => [r.key, r]));
  assert.equal(byKey["u-betsy"].abiertas, 1);
  assert.equal(byKey["u-betsy"].completadas, 1);
  assert.equal(byKey["u-andreina"].abiertas, 1);
  assert.equal(byKey[VENDEDOR_NINGUNO].abiertas, 2);
  assert.equal(byKey[VENDEDOR_NINGUNO].nombre, "Sin vendedor");
  assert.equal(byKey["u-juan"], undefined); // sin tareas en el conjunto
  // Orden: más abiertas primero, luego por nombre.
  assert.deepEqual(s.porVendedor.map((r) => r.key), [VENDEDOR_NINGUNO, "u-andreina", "u-betsy"]);
});

test("summarizeTasks con vendedor elegido muestra solo su fila", () => {
  const s = summarizeTasks([task({ client_id: "c1" })], assignees, { today: HOY, vendedor: "u-betsy" });
  assert.deepEqual(s.porVendedor.map((r) => r.key), ["u-betsy"]);
});

test("summarizeTasks: ranking de productos y líneas solo sobre tareas sin stock", () => {
  const s = summarizeTasks([
    task({ task_id: "a", anomaly_products: [prod("p1", "WAMPOLE FRESA", "Vitaminas"), prod("p2", "DIOXOGEN", null)] }),
    task({ task_id: "b", anomaly_products: [prod("p1", "WAMPOLE FRESA", "Vitaminas")] }),
    task({ task_id: "c", title: "Anomalía: diferencia_precios",
      anomaly_products: [{ ...prod("p3", "OTRO", "X"), anomaly_type: "diferencia_precios" }] }),
  ], assignees, { today: HOY });
  assert.deepEqual(s.topProductos, [
    { key: "p1", label: "WAMPOLE FRESA", n: 2 },
    { key: "p2", label: "DIOXOGEN", n: 1 },
  ]);
  assert.deepEqual(s.topLineas, [
    { key: "Vitaminas", label: "Vitaminas", n: 2 },
    { key: LINEA_NINGUNA, label: "Sin línea", n: 1 },
  ]);
});

const options: TaskFilterOptions = {
  vendedores: [{ value: "u-betsy", label: "Betsy Castro" }],
  clientes: [{ value: "c1", label: "FARMATODO" }],
  tipos: [], anomalias: [], productos: [{ value: "p1", label: "WAMPOLE FRESA" }], lineas: [],
};

test("describeTaskFilter arma la línea de contexto en español", () => {
  assert.equal(
    describeTaskFilter({ ...EMPTY_TASK_FILTER, anomalia: "sin_stock", desde: "2026-09-19", hasta: "2026-09-25" }, options, 45),
    "Mostrando 45 tareas · anomalía Sin stock · creadas del 19-sep al 25-sep",
  );
  assert.equal(
    describeTaskFilter({ ...DEFAULT_TASK_FILTER, vendedor: "u-betsy", antiguedad: ["16-30", "30+"] }, options, 1),
    "Mostrando 1 tarea abierta · vendedor Betsy Castro · 16–30 días, Más de 30 días",
  );
  assert.equal(
    describeTaskFilter({ ...EMPTY_TASK_FILTER, producto: "p1", cliente: "c1", status: "resolved" }, options, 3),
    "Mostrando 3 tareas completadas · cliente FARMATODO · producto WAMPOLE FRESA",
  );
});
