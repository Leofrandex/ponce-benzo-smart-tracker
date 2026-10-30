import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aplicarDiff, diffPlan, normalizarAncla, opcionesSemana, paradasDelDia, proximasVisitas,
  tocaEnFecha, versionesFuturas, versionVigente,
  type Frecuencia, type Parada, type Version, type Weekday,
} from "./plan";

const p = (weekday: Weekday, store_id: string, n: Frecuencia, anchor: string, position = 1): Parada =>
  ({ weekday, position, store_id, every_n_weeks: n, anchor_monday: anchor });
const ids = (ps: Parada[]) => ps.map((x) => x.store_id);

test("tocaEnFecha semanal toca todos los lunes", () => {
  const s = p(1, "a", 1, "2026-11-02");
  for (const d of ["2026-11-02", "2026-11-09", "2026-10-26"]) assert.equal(tocaEnFecha(s, d), true);
  assert.equal(tocaEnFecha(s, "2026-11-03"), false);
});

test("tocaEnFecha cada 2 alterna y acepta fechas anteriores al ancla", () => {
  const s = p(1, "a", 2, "2026-11-16");
  for (const d of ["2026-11-16", "2026-11-30", "2026-11-02"]) assert.equal(tocaEnFecha(s, d), true);
  for (const d of ["2026-11-09", "2026-11-23"]) assert.equal(tocaEnFecha(s, d), false);
});

test("tocaEnFecha cruza el cambio de año", () => {
  const s = p(1, "a", 2, "2026-12-28");
  assert.equal(tocaEnFecha(s, "2027-01-11"), true);
  assert.equal(tocaEnFecha(s, "2027-01-04"), false);
});

test("tocaEnFecha cada 3 y cada 4", () => {
  const s3 = p(1, "a", 3, "2026-11-02");
  assert.equal(tocaEnFecha(s3, "2026-11-23"), true);
  assert.equal(tocaEnFecha(s3, "2026-11-16"), false);
  const s4 = p(1, "a", 4, "2026-11-02");
  assert.equal(tocaEnFecha(s4, "2026-11-30"), true);
  assert.equal(tocaEnFecha(s4, "2026-11-23"), false);
});

test("paradasDelDia filtra y ordena por position", () => {
  const stops = [p(1, "b", 1, "2026-11-02", 2), p(1, "a", 1, "2026-11-02", 1), p(2, "c", 1, "2026-11-02", 1)];
  assert.deepEqual(ids(paradasDelDia(stops, "2026-11-02")), ["a", "b"]);
});

test("opcionesSemana desde miércoles empieza en su lunes", () => {
  assert.deepEqual(opcionesSemana("2026-11-18", 2), ["2026-11-16", "2026-11-23"]);
  assert.deepEqual(opcionesSemana("2026-11-16", 1), ["2026-11-16"]);
});

test("normalizarAncla mantiene la fase", () => {
  assert.equal(normalizarAncla("2026-10-26", "2026-11-16", 2), "2026-11-23");
  assert.equal(normalizarAncla("2026-11-02", "2026-11-16", 2), "2026-11-16");
});

test("proximasVisitas", () => {
  assert.deepEqual(
    proximasVisitas(p(1, "a", 2, "2026-11-16"), "2026-11-16", 4),
    ["2026-11-16", "2026-11-30", "2026-12-14", "2026-12-28"],
  );
});

test("proximasVisitas arranca en el siguiente día que toca si desde ya pasó esa semana", () => {
  assert.deepEqual(
    proximasVisitas(p(3, "a", 2, "2026-11-16"), "2026-11-19", 2),
    ["2026-12-02", "2026-12-16"],
  );
});

test("versionVigente y versionesFuturas", () => {
  const v = (effective_from: string): Version => ({ plan_id: effective_from, effective_from, created_at: null, stops: [] });
  const vs = [v("2026-12-01"), v("2026-11-16")];
  assert.equal(versionVigente(vs, "2026-11-20")?.effective_from, "2026-11-16");
  assert.equal(versionVigente(vs, "2026-11-10"), null);
  assert.deepEqual(versionesFuturas(vs, "2026-11-20").map((x) => x.effective_from), ["2026-12-01"]);
});

const A = "2026-11-16";
const base = [p(1, "a", 1, A, 1), p(1, "b", 1, A, 2), p(1, "c", 2, A, 3)];
const editado = [p(1, "c", 4, A, 1), p(1, "a", 1, A, 2), p(2, "b", 1, A, 1)];

test("diffPlan detecta altas, bajas, cambios y orden", () => {
  const d = diffPlan(base, editado);
  assert.deepEqual(d.altas.map((x) => `${x.weekday}${x.store_id}`), ["2b"]);
  assert.deepEqual(d.bajas, [{ weekday: 1, store_id: "b" }]);
  assert.deepEqual(d.cambios.map((x) => [x.weekday, x.store_id, x.every_n_weeks]), [[1, "c", 4]]);
  assert.deepEqual(d.orden[1], ["c", "a"]);
  assert.deepEqual(d.orden[2], ["b"]);
  assert.equal(d.orden[3], undefined);
});

test("aplicarDiff conserva lo propio de la versión futura", () => {
  const futura = [p(1, "a", 1, A, 1), p(1, "x", 1, A, 2), p(1, "b", 1, A, 3), p(1, "c", 2, A, 4)];
  const out = aplicarDiff(futura, diffPlan(base, editado));
  const lunes = out.filter((x) => x.weekday === 1).sort((x, y) => x.position - y.position);
  assert.deepEqual(ids(lunes), ["c", "a", "x"]);
  assert.equal(lunes[0].every_n_weeks, 4);
  assert.deepEqual(lunes.map((x) => x.position), [1, 2, 3]);
  const martes = out.filter((x) => x.weekday === 2);
  assert.deepEqual(ids(martes), ["b"]);
  assert.equal(martes[0].position, 1);
});

test("aplicarDiff ignora bajas que la futura ya no tiene", () => {
  const futura = [p(1, "a", 1, A, 1), p(1, "c", 2, A, 2)];
  const out = aplicarDiff(futura, diffPlan(base, editado));
  assert.ok(!out.some((x) => x.weekday === 1 && x.store_id === "b"));
});

test("aplicarDiff no reordena días que no se tocaron", () => {
  const b = [p(2, "a", 1, A, 1), p(2, "b", 1, A, 2), p(1, "x", 1, A, 1)];
  const e = [p(2, "a", 1, A, 1), p(2, "b", 1, A, 2)];
  const d = diffPlan(b, e);
  assert.equal(d.orden[2], undefined);
  const futura = [p(2, "b", 1, A, 1), p(2, "a", 1, A, 2), p(2, "y", 1, A, 3), p(1, "x", 1, A, 1)];
  const out = aplicarDiff(futura, d);
  assert.deepEqual(ids(out.filter((s) => s.weekday === 2)), ["b", "a", "y"]);
});
