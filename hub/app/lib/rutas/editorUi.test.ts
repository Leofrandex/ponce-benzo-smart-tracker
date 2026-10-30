import { test } from "node:test";
import assert from "node:assert/strict";
import { armarVersionesAGuardar, buscarTiendas, fechaCorta, rangoSemana } from "./editorUi";
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

test("armarVersionesAGuardar sin futuras o sin aplicar: solo la editada", () => {
  const stops = [p(1, 1, "a")];
  const fut: Version[] = [{ plan_id: "x", effective_from: "2026-12-07", created_at: "t", stops: [p(2, 1, "z")] }];
  assert.deepEqual(armarVersionesAGuardar([], stops, "2026-11-16", [], true), [{ effective_from: "2026-11-16", stops }]);
  assert.deepEqual(armarVersionesAGuardar([], stops, "2026-11-16", fut, false), [{ effective_from: "2026-11-16", stops }]);
});

test("armarVersionesAGuardar aplica el diff a las futuras", () => {
  const base = [p(1, 1, "a"), p(1, 2, "b")];
  const stops = [p(1, 1, "b"), p(1, 2, "c"), p(2, 1, "a", 2)]; // quita a del lunes, agrega c, a pasa al martes cada 2
  const fut: Version[] = [{ plan_id: "x", effective_from: "2026-12-07", created_at: "t", stops: [p(1, 1, "a"), p(1, 2, "b"), p(3, 1, "z")] }];
  const [primera, segunda] = armarVersionesAGuardar(base, stops, "2026-11-16", fut, true);
  assert.deepEqual(primera, { effective_from: "2026-11-16", stops });
  assert.equal(segunda.effective_from, "2026-12-07");
  const ids = (w: number) => segunda.stops.filter((s) => s.weekday === w).sort((x, y) => x.position - y.position).map((s) => s.store_id);
  assert.deepEqual(ids(1), ["b", "c"]);
  assert.deepEqual(ids(2), ["a"]);
  assert.deepEqual(ids(3), ["z"]); // lo propio de la futura se conserva
  assert.equal(segunda.stops.find((s) => s.store_id === "a")!.every_n_weeks, 2);
});
