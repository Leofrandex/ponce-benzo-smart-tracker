import { test } from "node:test";
import assert from "node:assert/strict";
import { visitStats } from "./visitStats";

const at = (d: number, h: number, status: string) => ({ check_in_time: new Date(2026, 10, d, h).toISOString(), status });

const now = new Date(2026, 10, 4, 15); // miércoles, hora local
test("hoy y semana excluyen omitidas; la semana empieza el lunes", () => {
  const rows = [at(4, 9, "completed"), at(4, 10, "skipped"), at(2, 9, "anomaly"), at(1, 9, "completed")];
  assert.deepEqual(visitStats(rows, now), { hoy: 1, semana: 2, completadas: 1 });
});
test("sin visitas: ceros", () => assert.deepEqual(visitStats([], now), { hoy: 0, semana: 0, completadas: 0 }));
test("domingo: la semana empezó seis días antes (lunes)", () => {
  const sunday = new Date(2026, 10, 8, 20);
  const rows = [at(8, 9, "completed"), at(2, 8, "completed"), at(1, 23, "completed")];
  assert.deepEqual(visitStats(rows, sunday), { hoy: 1, semana: 2, completadas: 2 });
});
