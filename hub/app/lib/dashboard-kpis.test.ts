import { test } from "node:test";
import assert from "node:assert/strict";
import { KPI_DEFS, kpiDef, type KpiId } from "./dashboard-kpis";

const IDS: KpiId[] = ["cumplimiento", "visitas", "anomalias", "tareas"];

test("hay una definicion por cada KPI declarado", () => {
  for (const id of IDS) {
    assert.ok(KPI_DEFS[id], `falta la definicion de ${id}`);
  }
  assert.equal(Object.keys(KPI_DEFS).length, IDS.length);
});

test("toda descripcion dice que entra y que no, no repite el titulo", () => {
  for (const id of IDS) {
    const d = kpiDef(id);
    assert.ok(d.descripcion.length > 60, `${id}: la descripcion es demasiado corta para explicar algo`);
    assert.notEqual(d.descripcion.trim(), d.etiqueta.trim(), `${id}: la descripcion repite el titulo`);
  }
});

test("la definicion de cumplimiento explica el denominador, que es lo que confundia", () => {
  const d = kpiDef("cumplimiento");
  assert.match(d.descripcion, /ruta/i);
  assert.match(d.descripcion, /transcurrid/i);
});

test("kpiDef devuelve la misma referencia que KPI_DEFS", () => {
  assert.equal(kpiDef("visitas"), KPI_DEFS.visitas);
});
