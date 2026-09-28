import { test } from "node:test";
import assert from "node:assert/strict";
import { fechaLocalISO, fechaDesdeISO } from "./localDate";

test("fechaLocalISO usa la fecha local, no la UTC", () => {
  const d = new Date(2026, 8, 27, 23, 30); // 27-sep 23:30 hora local
  assert.equal(fechaLocalISO(d), "2026-09-27");
});

test("fechaLocalISO rellena mes y día con cero", () => {
  assert.equal(fechaLocalISO(new Date(2026, 0, 5, 8, 0)), "2026-01-05");
});

test("fechaDesdeISO vuelve al mismo día local (ida y vuelta)", () => {
  assert.equal(fechaLocalISO(fechaDesdeISO("2026-09-27")), "2026-09-27");
});
