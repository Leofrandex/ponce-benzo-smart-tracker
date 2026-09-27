import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeLine, lineSuggestions, filterCatalog, type CatalogProduct } from "./products";

const p = (over: Partial<CatalogProduct>): CatalogProduct => ({
  product_id: "p", sku: "S1", name: "WAMPOLE FRESA", brand: "WAMPOLE", line: null, active: true, ...over,
});

test("normalizeLine recorta, colapsa espacios y vacío es null", () => {
  assert.equal(normalizeLine("  Vitaminas  ", []), "Vitaminas");
  assert.equal(normalizeLine("Cuidado   personal", []), "Cuidado personal");
  assert.equal(normalizeLine("   ", []), null);
});

test("normalizeLine reusa la línea existente ignorando mayúsculas y acentos", () => {
  const existing = ["Vitaminas", "Higiene íntima"];
  assert.equal(normalizeLine("vitaminas", existing), "Vitaminas");
  assert.equal(normalizeLine("VITAMINAS ", existing), "Vitaminas");
  assert.equal(normalizeLine("higiene intima", existing), "Higiene íntima");
  assert.equal(normalizeLine("Analgésicos", existing), "Analgésicos");
});

test("lineSuggestions: líneas distintas ordenadas, sin vacíos", () => {
  assert.deepEqual(lineSuggestions([p({ line: "Vitaminas" }), p({ line: null }), p({ line: "Analgésicos" }), p({ line: "Vitaminas" })]),
    ["Analgésicos", "Vitaminas"]);
});

test("filterCatalog busca en nombre, SKU y marca sin acentos, y filtra 'sin línea'", () => {
  const list = [
    p({ product_id: "a", name: "WAMPOLE FRESA", sku: "W1", brand: "WAMPOLE", line: "Vitaminas" }),
    p({ product_id: "b", name: "DIOXOGEN 120", sku: "D1", brand: "DIOXOGEN", line: null }),
  ];
  assert.deepEqual(filterCatalog(list, "fresa", false).map((x) => x.product_id), ["a"]);
  assert.deepEqual(filterCatalog(list, "d1", false).map((x) => x.product_id), ["b"]);
  assert.deepEqual(filterCatalog(list, "", true).map((x) => x.product_id), ["b"]);
  assert.deepEqual(filterCatalog(list, "", false).map((x) => x.product_id), ["a", "b"]);
});
