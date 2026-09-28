import { test } from "node:test";
import assert from "node:assert/strict";
import { filtrarClientes, opcionesGeoClientes, parseClientesParams, serializeClientesParams } from "./clientFilters";

const clients = [
  { client_id: "c1", name: "FARMATODO", business_channel: null, store_count: 3 },
  { client_id: "c2", name: "LOCATEL", business_channel: null, store_count: 1 },
];
const geo = [
  { client_id: "c1", estado: "Miranda", municipio: "Baruta" },
  { client_id: "c1", estado: "Miranda", municipio: "Chacao" },
  { client_id: "c1", estado: "Distrito Capital", municipio: "Libertador" },
  { client_id: "c2", estado: "Miranda", municipio: "Baruta" },
];
const asig = [{ user_id: "u1", full_name: "Betsy", client_id: "c2" }];

test("sin filtros devuelve todo tal cual", () => {
  assert.deepEqual(filtrarClientes(clients, geo, { estado: "", municipio: "", vendedor: "" }, asig), clients);
});

test("estado y municipio recalculan las sucursales", () => {
  const r = filtrarClientes(clients, geo, { estado: "Miranda", municipio: "Baruta", vendedor: "" }, asig);
  assert.deepEqual(r.map((c) => [c.name, c.store_count]), [["FARMATODO", 1], ["LOCATEL", 1]]);
});

test("municipio sin estado también filtra", () => {
  const r = filtrarClientes(clients, geo, { estado: "", municipio: "Chacao", vendedor: "" }, asig);
  assert.deepEqual(r.map((c) => [c.name, c.store_count]), [["FARMATODO", 1]]);
});

test("vendedor deja solo sus cadenas", () => {
  assert.deepEqual(filtrarClientes(clients, geo, { estado: "", municipio: "", vendedor: "u1" }, asig).map((c) => c.name), ["LOCATEL"]);
});

test("opciones de municipio dependen del estado", () => {
  assert.deepEqual(opcionesGeoClientes(geo, "Miranda"), { estados: ["Distrito Capital", "Miranda"], municipios: ["Baruta", "Chacao"] });
});

test("URL ida y vuelta", () => {
  const f = { estado: "Miranda", municipio: "Baruta", vendedor: "u1" };
  assert.deepEqual(parseClientesParams(new URLSearchParams(serializeClientesParams(f))), f);
  assert.equal(serializeClientesParams({ estado: "", municipio: "", vendedor: "" }), "");
});
