// tools/ingesta/routeDates.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { nthWeekdayOfMonth, generateRouteDates } from "./routeDates";

test("nthWeekdayOfMonth: julio 2026 (mes0=6). 1 jul 2026 = miércoles", () => {
  // Martes (weekday=2): 7, 14, 21, 28
  assert.equal(nthWeekdayOfMonth(2026, 6, 2, 1)!.toISOString().slice(0, 10), "2026-07-07");
  assert.equal(nthWeekdayOfMonth(2026, 6, 2, 3)!.toISOString().slice(0, 10), "2026-07-21");
  // Miércoles (weekday=3): 1, 8, 15, 22, 29 -> hay 5ª aparición
  assert.equal(nthWeekdayOfMonth(2026, 6, 3, 1)!.toISOString().slice(0, 10), "2026-07-01");
  assert.equal(nthWeekdayOfMonth(2026, 6, 3, 5)!.toISOString().slice(0, 10), "2026-07-29");
  // Domingo (weekday=7): 5,12,19,26 -> no hay 5ª
  assert.equal(nthWeekdayOfMonth(2026, 6, 7, 1)!.toISOString().slice(0, 10), "2026-07-05");
  assert.equal(nthWeekdayOfMonth(2026, 6, 7, 5), null);
});

test("generateRouteDates: martes semanas 1 y 3, agosto-septiembre 2026", () => {
  const from = new Date(Date.UTC(2026, 7, 1));
  const to = new Date(Date.UTC(2026, 8, 30));
  const dates = generateRouteDates({ weekdays: [2], weeks: [1, 3] }, from, to);
  // Ago 2026: 1 ago = sábado -> martes 4,11,18,25 -> sem1=4, sem3=18
  // Sep 2026: 1 sep = martes -> martes 1,8,15,22,29 -> sem1=1, sem3=15
  assert.deepEqual(dates, ["2026-08-04", "2026-08-18", "2026-09-01", "2026-09-15"]);
});

test("generateRouteDates: respeta límite 'from' (excluye fechas anteriores a hoy)", () => {
  const from = new Date(Date.UTC(2026, 6, 14)); // 14 jul 2026
  const to = new Date(Date.UTC(2026, 6, 31));
  // Martes semana 1 = 7 jul (antes de from) se excluye; semana 3 = 21 jul entra
  const dates = generateRouteDates({ weekdays: [2], weeks: [1, 3] }, from, to);
  assert.deepEqual(dates, ["2026-07-21"]);
});
