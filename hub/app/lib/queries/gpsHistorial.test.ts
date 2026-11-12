import { test } from "node:test";
import assert from "node:assert/strict";
import { coordenadasEn, type CambioGps } from "./gpsHistorial";

const c = (changed_at: string, o: number | null, n: number, extra: Partial<CambioGps> = {}): CambioGps => ({
  history_id: changed_at + (extra.orden ?? ""), store_id: "s", changed_at, orden: 1, changed_by_name: null,
  old_lat: o, old_lng: o, new_lat: n, new_lng: n, kind: "captura", ...extra,
});
const act = { lat: 5, lng: 5 };

test("sin cambios: coordenadas actuales", () => {
  assert.deepEqual(coordenadasEn("2026-11-01T10:00:00Z", act, []), { lat: 5, lng: 5 });
});
test("visita anterior a una captura: coordenadas viejas", () => {
  assert.deepEqual(coordenadasEn("2026-11-01T10:00:00Z", act, [c("2026-11-02T10:00:00Z", 1, 5)]), { lat: 1, lng: 1 });
});
test("visita posterior a la captura: coordenadas nuevas", () => {
  assert.deepEqual(coordenadasEn("2026-11-03T10:00:00Z", act, [c("2026-11-02T10:00:00Z", 1, 5)]), { lat: 5, lng: 5 });
});
test("varios cambios: usa el primero posterior a la visita", () => {
  const h = [c("2026-11-04T10:00:00Z", 2, 5), c("2026-11-02T10:00:00Z", 1, 2)];
  assert.deepEqual(coordenadasEn("2026-11-03T10:00:00Z", act, h), { lat: 2, lng: 2 });
});
test("tienda sin GPS el día de la visita: nulos", () => {
  assert.deepEqual(coordenadasEn("2026-11-01T10:00:00Z", act, [c("2026-11-02T10:00:00Z", null, 5)]), { lat: null, lng: null });
});
test("visita justo en changed_at: usa los valores nuevos de ese cambio", () => {
  assert.deepEqual(coordenadasEn("2026-11-02T10:00:00Z", act, [c("2026-11-02T10:00:00Z", 1, 5)]), { lat: 5, lng: 5 });
});
test("empate en changed_at: gana el de menor orden", () => {
  const h = [c("2026-11-02T10:00:00Z", 2, 5, { orden: 2 }), c("2026-11-02T10:00:00Z", 1, 2, { orden: 1 })];
  assert.deepEqual(coordenadasEn("2026-11-01T10:00:00Z", act, h), { lat: 1, lng: 1 });
});
test("fila de edición cuenta igual", () => {
  const h = [c("2026-11-02T10:00:00Z", 3, 5, { kind: "edicion" })];
  assert.deepEqual(coordenadasEn("2026-11-01T10:00:00Z", act, h), { lat: 3, lng: 3 });
});
test("no depende del orden de entrada", () => {
  const h = [c("2026-11-04T10:00:00Z", 2, 5), c("2026-11-02T10:00:00Z", 1, 2), c("2026-11-03T12:00:00Z", 2, 2)];
  const r = coordenadasEn("2026-11-03T10:00:00Z", act, h);
  assert.deepEqual(r, { lat: 2, lng: 2 });
  assert.deepEqual(coordenadasEn("2026-11-03T10:00:00Z", act, [...h].reverse()), r);
});
