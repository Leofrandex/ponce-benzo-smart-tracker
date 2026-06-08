import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveClientRows, deriveDashboard, type VisitRow, type TaskRow } from "./derive";
import type { Store } from "../types";

const store = (id: string, name: string): Store => ({
  store_id: id, name, address: null, master_lat: 10, master_lng: -66,
  active: true, created_at: "2024-01-01T00:00:00Z",
  contact_name: null, contact_phone: null, contact_email: null,
  estado: null, municipio: null, urbanizacion: null,
  business_channel: "farmacia", classification: null,
});

test("deriveClientRows suma tareas abiertas y resuelve la última visita por tienda", () => {
  const stores = [store("s1", "FTD A"), store("s2", "FTD B")];
  const visits: VisitRow[] = [
    { visit_id: "v1", store_id: "s1", check_in_time: "2026-06-01T10:00:00Z", status: "completed" },
    { visit_id: "v2", store_id: "s1", check_in_time: "2026-06-03T10:00:00Z", status: "anomaly" },
  ];
  const tasks: TaskRow[] = [
    { task_id: "t1", store_id: "s1", status: "open" },
    { task_id: "t2", store_id: "s1", status: "resolved" },
  ];
  const rows = deriveClientRows(stores, visits, tasks);
  const r1 = rows.find((r) => r.store_id === "s1")!;
  const r2 = rows.find((r) => r.store_id === "s2")!;
  assert.equal(r1.pending_tasks, 1);
  assert.equal(r1.last_visit_status, "anomaly");
  assert.equal(r1.last_visit_date, "2026-06-03T10:00:00Z");
  assert.equal(r2.pending_tasks, 0);
  assert.equal(r2.last_visit_date, null);
});

test("deriveDashboard cuenta visitas, anomalías y tareas resueltas en el rango", () => {
  const visits: VisitRow[] = [
    { visit_id: "v1", store_id: "s1", check_in_time: "2026-06-07T10:00:00Z", status: "completed" },
    { visit_id: "v2", store_id: "s1", check_in_time: "2026-06-07T11:00:00Z", status: "anomaly" },
    { visit_id: "v3", store_id: "s2", check_in_time: "2026-01-01T10:00:00Z", status: "completed" },
  ];
  const tasks: TaskRow[] = [
    { task_id: "t1", store_id: "s1", status: "resolved" },
    { task_id: "t2", store_id: "s1", status: "open" },
  ];
  const cutoff = new Date("2026-06-01T00:00:00Z").getTime();
  const d = deriveDashboard(visits, tasks, cutoff);
  assert.equal(d.totalVisits, 2);
  assert.equal(d.totalAnomalies, 1);
  assert.equal(d.resolvedTasks, 1);
});
