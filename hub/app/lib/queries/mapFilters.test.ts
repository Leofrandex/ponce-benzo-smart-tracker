import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TODAS, NINGUNA, DEFAULT_MAP_FILTER, incluye, aplicar, toggleUno, setVarios, estadoGrupo,
  agruparPorCadena, elegirVendedor, resumenMapa, parseMapParams, serializeMapParams, type TiendaMapa,
} from "./mapFilters";

const T = (store_id: string, client_id: string | null, client_name: string | null): TiendaMapa =>
  ({ store_id, name: `Tienda ${store_id}`, client_id, client_name });
const stores = [T("a1", "c1", "FARMATODO"), T("a2", "c1", "FARMATODO"), T("b1", "c2", "LOCATEL"), T("x1", null, null)];
const all = stores.map((s) => s.store_id);
const asig = [{ user_id: "u1", full_name: "Betsy", client_id: "c2" }];

test("TODAS incluye todo; NINGUNA no incluye nada; aplicar respeta ambos", () => {
  assert.equal(incluye(TODAS, "a1"), true);
  assert.equal(incluye(NINGUNA, "a1"), false);
  assert.deepEqual(aplicar(stores, NINGUNA, (s) => s.store_id), []);
  assert.equal(aplicar(stores, TODAS, (s) => s.store_id).length, 4);
});

test("toggleUno desde TODAS deja todas menos esa; setVarios marca/desmarca un grupo", () => {
  assert.deepEqual(toggleUno(TODAS, "a1", all), { modo: "seleccion", ids: ["a2", "b1", "x1"] });
  assert.deepEqual(toggleUno(NINGUNA, "a1", all), { modo: "seleccion", ids: ["a1"] });
  assert.deepEqual(setVarios(NINGUNA, ["a1", "a2"], true, all), { modo: "seleccion", ids: ["a1", "a2"] });
  assert.deepEqual(setVarios(TODAS, ["a1", "a2"], false, all), { modo: "seleccion", ids: ["b1", "x1"] });
  // Marcar lo que falta vuelve a TODAS.
  assert.deepEqual(setVarios({ modo: "seleccion", ids: ["b1", "x1"] }, ["a1", "a2"], true, all), TODAS);
});

test("estadoGrupo: todas / algunas / ninguna", () => {
  assert.equal(estadoGrupo(TODAS, ["a1", "a2"]), "todas");
  assert.equal(estadoGrupo({ modo: "seleccion", ids: ["a1"] }, ["a1", "a2"]), "algunas");
  assert.equal(estadoGrupo(NINGUNA, ["a1", "a2"]), "ninguna");
});

test("agruparPorCadena ordena por nombre y deja 'Sin cadena' al final", () => {
  const g = agruparPorCadena(stores);
  assert.deepEqual(g.map((x) => [x.nombre, x.tiendas.length]), [["FARMATODO", 2], ["LOCATEL", 1], ["Sin cadena", 1]]);
});

test("elegirVendedor selecciona sus tiendas una sola vez; los ajustes manuales posteriores se respetan", () => {
  const v = elegirVendedor(DEFAULT_MAP_FILTER, "u1", stores, asig);
  assert.equal(v.vendedor, "u1");
  assert.deepEqual(v.tiendas, { modo: "seleccion", ids: ["b1"] });
  const ajustado = { ...v, tiendas: toggleUno(v.tiendas, "a1", all) };
  assert.deepEqual(ajustado.tiendas, { modo: "seleccion", ids: ["b1", "a1"] });
  assert.equal(ajustado.vendedor, "u1");
  assert.deepEqual(elegirVendedor(ajustado, "", stores, asig), { ...ajustado, vendedor: "", tiendas: TODAS });
});

test("resumenMapa describe la selección en español", () => {
  const g = agruparPorCadena(stores);
  assert.equal(resumenMapa(DEFAULT_MAP_FILTER, g, 5), "Todas las tiendas · todos los mercaderistas");
  assert.equal(resumenMapa({ ...DEFAULT_MAP_FILTER, tiendas: { modo: "seleccion", ids: ["a1", "a2", "b1"] }, merch: { modo: "seleccion", ids: ["m1", "m2"] } }, g, 5),
    "2 cadenas · 3 tiendas · 2 mercaderistas");
  assert.equal(resumenMapa({ ...DEFAULT_MAP_FILTER, tiendas: NINGUNA, merch: NINGUNA }, g, 5), "Ninguna tienda · ningún mercaderista");
});

test("URL: cadenas completas viajan como cadenas=, sueltas como tiendas=; ida y vuelta", () => {
  const g = agruparPorCadena(stores);
  // a1+a2 completan FARMATODO (cadena); x1 no tiene cadena y viaja suelta.
  const v = { tiendas: { modo: "seleccion" as const, ids: ["a1", "a2", "x1"] }, merch: { modo: "seleccion" as const, ids: ["m1"] }, vendedor: "u1" };
  const qs = serializeMapParams(v, g);
  const p = new URLSearchParams(qs);
  assert.equal(p.get("cadenas"), "c1");
  assert.equal(p.get("tiendas"), "x1");
  assert.equal(p.get("merch"), "m1");
  assert.equal(p.get("vendedor"), "u1");
  const back = parseMapParams(p, stores);
  assert.deepEqual(Array.from((back.tiendas as { ids: string[] }).ids).sort(), ["a1", "a2", "x1"]);
  assert.deepEqual(back.merch, { modo: "seleccion", ids: ["m1"] });
});

test("URL: defaults, ninguna y ids desconocidos", () => {
  const g = agruparPorCadena(stores);
  assert.equal(serializeMapParams(DEFAULT_MAP_FILTER, g), "");
  assert.deepEqual(parseMapParams(new URLSearchParams(""), stores), DEFAULT_MAP_FILTER);
  const q = serializeMapParams({ ...DEFAULT_MAP_FILTER, tiendas: NINGUNA, merch: NINGUNA }, g);
  assert.deepEqual(parseMapParams(new URLSearchParams(q), stores), { ...DEFAULT_MAP_FILTER, tiendas: NINGUNA, merch: NINGUNA });
  // Ids que ya no existen se ignoran.
  assert.deepEqual(parseMapParams(new URLSearchParams("tiendas=zz,a1"), stores).tiendas, { modo: "seleccion", ids: ["a1"] });
});
