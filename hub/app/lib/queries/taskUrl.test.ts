import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTaskParams, serializeTaskParams } from "./taskUrl";
import { DEFAULT_TASK_FILTER, type TaskFilterValue } from "./taskFilters";

const p = (qs: string) => new URLSearchParams(qs);

test("sin parámetros = filtro por defecto (abiertas)", () => {
  assert.deepEqual(parseTaskParams(p("")), DEFAULT_TASK_FILTER);
  assert.equal(serializeTaskParams(DEFAULT_TASK_FILTER), "");
});

test("ida y vuelta conserva todos los campos", () => {
  const v: TaskFilterValue = {
    status: "all",
    geo: { estado: "Miranda", municipio: "Baruta", urbanizacion: "Las Mercedes" },
    vendedor: "u-betsy", cliente: "c1", tipo: "reponer_stock", texto: "wampole fresa",
    anomalia: "sin_stock", producto: "p1", linea: "Vitaminas",
    desde: "2026-09-19", hasta: "2026-09-25", antiguedad: ["16-30", "30+"],
  };
  assert.deepEqual(parseTaskParams(p(serializeTaskParams(v))), v);
});

test("enlace directo a una tarea sin estado explícito muestra todas (la tarea puede estar completada)", () => {
  assert.equal(parseTaskParams(p("task=abc")).status, "all");
  assert.equal(parseTaskParams(p("task=abc&estado=open")).status, "open");
});

test("con tarea enlazada el estado se escribe siempre, para que la ida y vuelta no cambie", () => {
  const v = { ...DEFAULT_TASK_FILTER, status: "open" as const };
  const qs = serializeTaskParams(v, "abc");
  assert.match(qs, /estado=open/);
  assert.match(qs, /task=abc/);
  assert.equal(parseTaskParams(p(qs)).status, "open");
});

test("valores inválidos se ignoran sin romper", () => {
  const v = parseTaskParams(p("estado=cualquiercosa&antiguedad=abc,0-7,99&desde=2026-13-40&hasta=ayer"));
  assert.equal(v.status, "open");
  assert.deepEqual(v.antiguedad, ["0-7"]);
  assert.equal(v.desde, "");
  assert.equal(v.hasta, "");
});

test("'30+' que llega como '30 ' (el + se decodifica como espacio) se interpreta como 30+", () => {
  assert.deepEqual(parseTaskParams(p("antiguedad=16-30,30+")).antiguedad, ["16-30", "30+"]);
  assert.deepEqual(parseTaskParams(p("antiguedad=%2B30")).antiguedad, ["30+"]);
});

test("antigüedad sin duplicados y en orden de tramos", () => {
  assert.deepEqual(parseTaskParams(p("antiguedad=30%2B,0-7,0-7")).antiguedad, ["0-7", "30+"]);
});
