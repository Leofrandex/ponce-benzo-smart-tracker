import { test } from "node:test";
import assert from "node:assert/strict";
import { clientesDeVendedor, tiendasDeVendedor } from "./vendorScope";

const asig = [
  { user_id: "u1", full_name: "Betsy", client_id: "c1" },
  { user_id: "u1", full_name: "Betsy", client_id: "c2" },
  { user_id: "u2", full_name: "Juan", client_id: "c3" },
];
const stores = [
  { store_id: "s1", client_id: "c1" }, { store_id: "s2", client_id: "c2" },
  { store_id: "s3", client_id: "c3" }, { store_id: "s4", client_id: null },
];

test("clientesDeVendedor devuelve las cadenas del vendedor", () => {
  assert.deepEqual(Array.from(clientesDeVendedor(asig, "u1")).sort(), ["c1", "c2"]);
  assert.equal(clientesDeVendedor(asig, "zz").size, 0);
});

test("tiendasDeVendedor devuelve las tiendas de sus cadenas, nunca las sin cadena", () => {
  assert.deepEqual(tiendasDeVendedor(stores, asig, "u1"), ["s1", "s2"]);
  assert.deepEqual(tiendasDeVendedor(stores, asig, "u2"), ["s3"]);
});
