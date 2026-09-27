import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeDetalle, groupByDay, toJornadas, type DetalleRow } from "./merchandisers";

const row = (over: Partial<DetalleRow>): DetalleRow => ({
  fecha: "2026-09-25", store_id: "s1", store_name: "FTD CENTRO", client_name: "FARMATODO",
  resultado: "completada", skip_reason: null, anomaly_type: null, visit_id: "v1", check_in_time: "2026-09-25T14:00:00Z",
  ...over,
});

test("summarizeDetalle cuenta cada resultado y calcula el % como el dashboard", () => {
  const r = summarizeDetalle([
    row({ resultado: "completada" }), row({ resultado: "anomalia" }), row({ resultado: "cubierta" }),
    row({ resultado: "omitida", skip_reason: "sin_acceso" }), row({ resultado: "no_visitada" }), row({ resultado: "no_visitada" }),
  ]);
  assert.deepEqual(r, { planificadas: 6, hechas: 3, completadas: 1, anomalias: 1, cubiertas: 1, omitidas: 1, no_visitadas: 2, pct: 50 });
});

test("summarizeDetalle redondea como SQL round() y sin planificadas da 0", () => {
  assert.equal(summarizeDetalle([row({}), row({}), row({ resultado: "no_visitada" })]).pct, 67);
  assert.deepEqual(summarizeDetalle([]), { planificadas: 0, hechas: 0, completadas: 0, anomalias: 0, cubiertas: 0, omitidas: 0, no_visitadas: 0, pct: 0 });
});

test("groupByDay agrupa por fecha, más reciente primero, con su resumen", () => {
  const dias = groupByDay([
    row({ fecha: "2026-09-24", store_id: "a" }),
    row({ fecha: "2026-09-25", store_id: "b", resultado: "no_visitada" }),
    row({ fecha: "2026-09-25", store_id: "c" }),
  ]);
  assert.deepEqual(dias.map((d) => d.fecha), ["2026-09-25", "2026-09-24"]);
  assert.equal(dias[0].tiendas.length, 2);
  assert.equal(dias[0].resumen.pct, 50);
  assert.equal(dias[1].resumen.pct, 100);
});

test("toJornadas calcula la duración, fecha de Caracas y deja null si no cerró", () => {
  const j = toJornadas([
    { session_id: "a", session_start: "2026-09-25T12:00:00Z", session_end: "2026-09-25T20:30:00Z" },
    { session_id: "b", session_start: "2026-09-26T02:30:00Z", session_end: null },
  ]);
  // 02:30 UTC del 26-sep es el 25-sep en Caracas.
  assert.deepEqual(j.map((x) => [x.fecha, x.minutos]), [["2026-09-25", 510], ["2026-09-25", null]]);
});
