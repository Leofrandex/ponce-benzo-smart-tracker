import { test } from "node:test";
import assert from "node:assert/strict";
import { filterClientsByEstado, estadoOptions, type StoreGeoRow, type ClientRow } from "./clients";

const client = (id: string, name: string, n: number): ClientRow =>
  ({ client_id: id, name, business_channel: null, store_count: n });

const geo: StoreGeoRow[] = [
  { client_id: "c1", estado: "MIRANDA" },
  { client_id: "c1", estado: "MIRANDA" },
  { client_id: "c1", estado: "DISTRITO CAPITAL" },
  { client_id: "c2", estado: "DISTRITO CAPITAL" },
  { client_id: "c3", estado: null },
];

test("estadoOptions devuelve estados únicos ordenados sin nulls", () => {
  assert.deepEqual(estadoOptions(geo), ["DISTRITO CAPITAL", "MIRANDA"]);
});

test("filterClientsByEstado sin estado devuelve todo igual", () => {
  const clients = [client("c1", "FTD", 3), client("c2", "RIO", 1)];
  assert.deepEqual(filterClientsByEstado(clients, geo, ""), clients);
});

test("filterClientsByEstado recalcula conteos y excluye cadenas sin tiendas en el estado", () => {
  const clients = [client("c1", "FTD", 3), client("c2", "RIO", 1), client("c3", "OTR", 1)];
  const out = filterClientsByEstado(clients, geo, "MIRANDA");
  assert.deepEqual(out, [{ ...client("c1", "FTD", 3), store_count: 2 }]);
});
