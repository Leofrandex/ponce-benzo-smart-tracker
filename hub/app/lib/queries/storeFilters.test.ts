import { test } from "node:test";
import assert from "node:assert/strict";
import { filtrarTiendas, parseTiendasParams, serializeTiendasParams } from "./storeFilters";
import { EMPTY_FILTERS } from "./storeFilters";
import type { ClientRow } from "./derive";

const row = (over: Partial<ClientRow>): ClientRow => ({
  store_id: "s", name: "FTD CENTRO", address: null, master_lat: 0, master_lng: 0, active: true, created_at: "",
  contact_name: null, contact_phone: null, contact_email: null, estado: "Miranda", municipio: "Baruta", urbanizacion: null,
  business_channel: "farmacia", classification: "A", client_id: "c1", client_name: "FARMATODO",
  last_visit_date: null, last_visit_status: null, pending_tasks: 0, ...over,
} as ClientRow);
const asig = [{ user_id: "u1", full_name: "Betsy", client_id: "c2" }];

test("vendedor deja solo tiendas de sus cadenas; resto de filtros se combinan con AND", () => {
  const rows = [row({ store_id: "a", client_id: "c1" }), row({ store_id: "b", client_id: "c2", name: "LOCATEL X" })];
  assert.deepEqual(filtrarTiendas(rows, { ...EMPTY_FILTERS, vendedor: "u1" }, "", asig).map((r) => r.store_id), ["b"]);
  assert.deepEqual(filtrarTiendas(rows, { ...EMPTY_FILTERS }, "locatel", asig).map((r) => r.store_id), ["b"]);
  assert.deepEqual(filtrarTiendas(rows, { ...EMPTY_FILTERS, classifications: ["B"] }, "", asig), []);
});

test("URL ida y vuelta de todos los filtros", () => {
  const f = { ...EMPTY_FILTERS, clientId: "c1", vendedor: "u1", estado: "Miranda", municipio: "Baruta", urbanizacion: "X", channel: "farmacia", classifications: ["A", "C"] };
  const back = parseTiendasParams(new URLSearchParams(serializeTiendasParams(f, "centro")));
  assert.deepEqual(back, { filters: f, q: "centro" });
  assert.equal(serializeTiendasParams(EMPTY_FILTERS, ""), "");
  // El parámetro existente ?client= se sigue leyendo.
  assert.equal(parseTiendasParams(new URLSearchParams("client=c9")).filters.clientId, "c9");
});
