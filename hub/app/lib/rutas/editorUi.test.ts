import { test } from "node:test";
import assert from "node:assert/strict";
import { buscarTiendas, esConflictoVersion, fechaCorta, numerosDelDia, proximoLunes, rangoSemana, semanaComoPlantilla, versionesAGuardar } from "./editorUi";
import type { Parada, Version } from "./plan";

const p = (weekday: Parada["weekday"], position: number, store_id: string, every_n_weeks: Parada["every_n_weeks"] = 1, anchor_monday = "2026-11-16"): Parada =>
  ({ weekday, position, store_id, every_n_weeks, anchor_monday });

test("fechaCorta", () => {
  assert.equal(fechaCorta("2026-11-16"), "16 nov");
  assert.equal(fechaCorta("2027-01-04"), "4 ene");
});

test("rangoSemana mismo mes y cruzando mes", () => {
  assert.equal(rangoSemana("2026-11-16"), "16 – 20 nov");
  assert.equal(rangoSemana("2026-11-30"), "30 nov – 4 dic");
});

test("buscarTiendas: activas, no repetidas en el día, sin acentos, por cliente o zona", () => {
  const ts = [
    { store_id: "a", name: "GAMA Santa Mónica", client_name: "Gama", zona: "Libertador", active: true },
    { store_id: "b", name: "FTD Monjes", client_name: "Farmatodo", zona: "Libertador", active: true },
    { store_id: "c", name: "Locatel Monica", client_name: "Locatel", zona: "Baruta", active: false },
  ];
  assert.deepEqual(buscarTiendas(ts, "monica", new Set()).map((t) => t.store_id), ["a"]);
  assert.deepEqual(buscarTiendas(ts, "liber", new Set(["a"])).map((t) => t.store_id), ["b"]);
  assert.deepEqual(buscarTiendas(ts, "farma", new Set()).map((t) => t.store_id), ["b"]);
  assert.deepEqual(buscarTiendas(ts, "  ", new Set()), []);
});

const v = (effective_from: string, stops: Parada[]): Version => ({ plan_id: effective_from, effective_from, created_at: "t", stops });

test("proximoLunes: la semana que viene, desde cualquier día", () => {
  assert.equal(proximoLunes("2026-11-13"), "2026-11-16"); // viernes
  assert.equal(proximoLunes("2026-11-09"), "2026-11-16"); // lunes: no la semana en curso
  assert.equal(proximoLunes("2026-11-08"), "2026-11-09"); // domingo: mañana
});

test("semanaComoPlantilla: lo que toca esa semana, todo semanal desde ese lunes", () => {
  // b cada 2 desde el 9 nov: toca el 23, no el 16. Desde el 18 rige otra versión (a, c).
  const v1 = v("2026-11-09", [p(1, 1, "a", 1, "2026-11-09"), p(1, 2, "b", 2, "2026-11-09"), p(3, 1, "x")]);
  const vs = [v1, v("2026-11-18", [p(1, 1, "a"), p(3, 1, "c")])];
  assert.deepEqual(semanaComoPlantilla(vs, "2026-11-16"), [p(1, 1, "a"), p(3, 1, "c")]); // lunes de v1, miércoles de v2
  const sem23 = semanaComoPlantilla([v1], "2026-11-23");
  assert.deepEqual(sem23.map((s) => s.store_id), ["a", "b", "x"]);
  assert.ok(sem23.every((s) => s.every_n_weeks === 1 && s.anchor_monday === "2026-11-23"));
  assert.deepEqual(semanaComoPlantilla([], "2026-11-16"), []);
});

test("versionesAGuardar: rige desde el lunes y pisa las versiones programadas después", () => {
  const stops = [p(1, 1, "a")];
  const vs = [v("2026-11-09", []), v("2026-11-16", []), v("2026-12-07", [p(2, 1, "z")])];
  assert.deepEqual(versionesAGuardar(stops, "2026-11-16", vs), [
    { effective_from: "2026-11-16", stops },
    { effective_from: "2026-12-07", stops },
  ]);
  assert.deepEqual(versionesAGuardar(stops, "2026-11-16", []), [{ effective_from: "2026-11-16", stops }]);
});

test("numerosDelDia: nada antes de que rija, sin contar inactivas", () => {
  const stops = [p(3, 1, "a"), p(3, 2, "b"), p(3, 3, "c"), p(3, 4, "d", 2)]; // d cada 2 desde el 16 nov
  const todas = () => true;
  assert.deepEqual(Array.from(numerosDelDia(stops, "2026-11-18", "2026-11-18", todas)), [["a", 1], ["b", 2], ["c", 3], ["d", 4]]);
  assert.deepEqual(Array.from(numerosDelDia(stops, "2026-11-25", "2026-11-18", todas)), [["a", 1], ["b", 2], ["c", 3]]);
  assert.equal(numerosDelDia(stops, "2026-11-18", "2026-11-19", todas).size, 0); // sigue la ruta anterior
  assert.deepEqual(Array.from(numerosDelDia(stops, "2026-11-18", "2026-11-18", (id) => id !== "b")), [["a", 1], ["c", 2], ["d", 3]]);
});

test("esConflictoVersion", () => {
  assert.ok(esConflictoVersion("La ruta cambió mientras la editabas. Recarga para ver la versión actual."));
  assert.ok(!esConflictoVersion("Hay sucursales inactivas en la ruta."));
});
