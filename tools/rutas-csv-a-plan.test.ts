import { test } from "node:test";
import * as assert from "node:assert/strict";
import { frecuencia, ancla, planDesdeFilas } from "./rutas-csv-a-plan";

test("frecuencia", () => {
  assert.equal(frecuencia([1, 2, 3, 4]), 1);
  assert.equal(frecuencia([2, 3, 4]), 1);
  assert.equal(frecuencia([1, 3]), 2);
  assert.equal(frecuencia([4, 2]), 2);
  assert.equal(frecuencia([3]), 4);
  assert.throws(() => frecuencia([1, 2]));
});

test("ancla: primera fecha desde el 9-nov que cae en las semanas pedidas", () => {
  // nov-2026: lunes 2 (sem 1), 9 (2), 16 (3), 23 (4), 30 (5); viernes 6 (1), 13 (2), 20 (3)
  assert.equal(ancla([1, 2, 3, 4], 3, "2026-11-09", 1), "2026-11-09");
  assert.equal(ancla([1, 3], 1, "2026-11-09", 2), "2026-11-16");
  assert.equal(ancla([2, 4], 1, "2026-11-09", 2), "2026-11-09");
  assert.equal(ancla([1], 1, "2026-11-09", 4), "2026-12-07"); // salta la semana 5 (30-nov)
  assert.equal(ancla([3], 5, "2026-11-09", 4), "2026-11-16"); // viernes 20 = 3er viernes
});

test("planDesdeFilas: frecuencia, orden y tienda repetida el mismo día", () => {
  const f = (pdv: string, store_id: string, semana: number, dia: number, orden: number) => ({ pdv, store_id, semana, dia, orden });
  const p = planDesdeFilas([
    ...[1, 2, 3, 4].map((s) => f("A", "a", s, 1, 2)),
    f("B", "b", 1, 1, 1), f("B", "b", 3, 1, 1),
    ...[1, 2, 3, 4].map((s) => f("C", "a", s, 1, 3)), // misma tienda que A, mismo día
    f("D", "d", 2, 2, 1),
  ], "2026-11-09");
  assert.deepEqual(p.map((x) => [x.pdv, x.weekday, x.position, x.every_n_weeks]), [["B", 1, 1, 2], ["A", 1, 2, 1], ["D", 2, 1, 4]]);
});
