import { test } from "node:test";
import assert from "node:assert/strict";
import { contarCambios, iniciarEditor, reducir, stopsDelDia, type Accion, type EditorState } from "./editorState";
import { opcionesSemana, type Parada, type Weekday } from "./plan";

const run = (s: EditorState, ...as: Accion[]) => as.reduce(reducir, s);
const ids = (s: EditorState, w: Weekday) => stopsDelDia(s, w).map((x) => x.store_id);
const pos = (s: EditorState, w: Weekday) => stopsDelDia(s, w).map((x) => x.position);
const add = (weekday: Weekday, store_id: string): Accion => ({ tipo: "agregar", weekday, store_id });

test("iniciarEditor vacío", () => {
  const s = iniciarEditor([], "2026-11-16");
  assert.deepEqual(s.stops, []);
  assert.equal(contarCambios(s), 0);
});

test("agregar pone al final, semanal, ancla del lunes de la fecha", () => {
  const s = run(iniciarEditor([], "2026-11-18"), add(1, "a"), add(1, "b"));
  assert.deepEqual(ids(s, 1), ["a", "b"]);
  assert.deepEqual(pos(s, 1), [1, 2]);
  assert.ok(s.stops.every((x) => x.every_n_weeks === 1 && x.anchor_monday === "2026-11-16"));
  assert.equal(contarCambios(s), 2);
});

test("agregar no duplica en el mismo día", () => {
  const s = run(iniciarEditor([], "2026-11-16"), add(1, "a"), add(1, "a"));
  assert.equal(s.stops.length, 1);
});

test("quitar renumera posiciones", () => {
  const s = run(iniciarEditor([], "2026-11-16"), add(1, "a"), add(1, "b"), add(1, "c"),
    { tipo: "quitar", weekday: 1, store_id: "a" });
  assert.deepEqual(ids(s, 1), ["b", "c"]);
  assert.deepEqual(pos(s, 1), [1, 2]);
});

test("mover entre días y dentro del día", () => {
  let s = run(iniciarEditor([], "2026-11-16"), add(1, "a"), add(1, "b"), add(1, "c"));
  s = reducir(s, { tipo: "mover", store_id: "c", desde: 1, hacia: 1, indice: 0 });
  assert.deepEqual(ids(s, 1), ["c", "a", "b"]);
  s = reducir(s, { tipo: "mover", store_id: "a", desde: 1, hacia: 2, indice: 0 });
  assert.deepEqual(ids(s, 1), ["c", "b"]);
  assert.deepEqual(ids(s, 2), ["a"]);
  assert.deepEqual(pos(s, 1), [1, 2]);
  assert.deepEqual(pos(s, 2), [1]);
});

test("mover a un día donde ya está la tienda no hace nada", () => {
  const s = run(iniciarEditor([], "2026-11-16"), add(1, "a"), add(2, "a"));
  const t = reducir(s, { tipo: "mover", store_id: "a", desde: 1, hacia: 2, indice: 0 });
  assert.deepEqual(t, s);
});

test("frecuencia y semana", () => {
  let s = run(iniciarEditor([], "2026-11-16"), add(1, "a"));
  s = reducir(s, { tipo: "frecuencia", weekday: 1, store_id: "a", n: 2 });
  assert.equal(s.stops[0].every_n_weeks, 2);
  assert.equal(s.stops[0].anchor_monday, "2026-11-16");
  s = reducir(s, { tipo: "semana", weekday: 1, store_id: "a", anchor_monday: "2026-11-23" });
  assert.equal(s.stops[0].anchor_monday, "2026-11-23");
  s = reducir(s, { tipo: "frecuencia", weekday: 1, store_id: "a", n: 4 });
  assert.equal(s.stops[0].anchor_monday, "2026-11-23"); // conserva la fase
  s = reducir(s, { tipo: "frecuencia", weekday: 1, store_id: "a", n: 1 });
  assert.equal(s.stops[0].anchor_monday, "2026-11-16");
});

test("fecha reancla manteniendo fase", () => {
  let s = run(iniciarEditor([], "2026-11-16"), add(1, "a"), { tipo: "frecuencia", weekday: 1, store_id: "a", n: 2 });
  assert.equal(reducir(s, { tipo: "fecha", effectiveFrom: "2026-11-30" }).stops[0].anchor_monday, "2026-11-30");
  s = reducir(s, { tipo: "fecha", effectiveFrom: "2026-12-07" });
  assert.equal(s.effectiveFrom, "2026-12-07");
  assert.equal(s.stops[0].anchor_monday, "2026-12-14");
  assert.deepEqual(s.base, []);
});

test("iniciarEditor normaliza anclas de base", () => {
  const base: Parada[] = [{ weekday: 1, position: 1, store_id: "a", every_n_weeks: 2, anchor_monday: "2026-11-02" }];
  const s = iniciarEditor(base, "2026-11-16");
  assert.equal(s.base[0].anchor_monday, "2026-11-16");
  assert.equal(contarCambios(s), 0);
});

test("descartar vuelve a base", () => {
  const base: Parada[] = [{ weekday: 1, position: 1, store_id: "a", every_n_weeks: 1, anchor_monday: "2026-11-16" }];
  const s0 = iniciarEditor(base, "2026-11-16");
  const s = run(s0, add(1, "b"), add(2, "c"), { tipo: "quitar", weekday: 1, store_id: "a" });
  assert.ok(contarCambios(s) > 0);
  const t = reducir(s, { tipo: "descartar" });
  assert.deepEqual(t.stops, t.base);
  assert.equal(contarCambios(t), 0);
});

test("fecha sin ediciones no genera cambios", () => {
  const base: Parada[] = [
    { weekday: 1, position: 1, store_id: "a", every_n_weeks: 1, anchor_monday: "2026-11-16" },
    { weekday: 2, position: 1, store_id: "b", every_n_weeks: 2, anchor_monday: "2026-11-16" },
  ];
  const s = reducir(iniciarEditor(base, "2026-11-16"), { tipo: "fecha", effectiveFrom: "2026-11-30" });
  assert.equal(contarCambios(s), 0);
  assert.equal(s.base[0].anchor_monday, "2026-11-30");
});

test("fecha conserva las ediciones reales", () => {
  const base: Parada[] = [{ weekday: 1, position: 1, store_id: "a", every_n_weeks: 1, anchor_monday: "2026-11-16" }];
  const s = run(iniciarEditor(base, "2026-11-16"), add(1, "c"), { tipo: "fecha", effectiveFrom: "2026-11-30" });
  assert.equal(contarCambios(s), 1);
  assert.equal(stopsDelDia(s, 1)[1].anchor_monday, "2026-11-30");
});

test("descartar tras fecha y ediciones deja estado consistente", () => {
  const base: Parada[] = [{ weekday: 1, position: 1, store_id: "a", every_n_weeks: 2, anchor_monday: "2026-11-16" }];
  const s = run(iniciarEditor(base, "2026-11-16"), { tipo: "fecha", effectiveFrom: "2026-12-07" }, add(3, "x"), { tipo: "descartar" });
  assert.equal(contarCambios(s), 0);
  assert.ok(s.stops.every((p) => opcionesSemana(s.effectiveFrom, p.every_n_weeks).includes(p.anchor_monday)));
});

test("semana ignora un ancla fuera de las opciones", () => {
  const s = run(iniciarEditor([], "2026-11-16"), add(1, "a"), { tipo: "frecuencia", weekday: 1, store_id: "a", n: 2 });
  assert.deepEqual(reducir(s, { tipo: "semana", weekday: 1, store_id: "a", anchor_monday: "2026-12-07" }), s);
});
