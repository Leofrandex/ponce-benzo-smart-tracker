// tools/ingesta/tiendasConfig.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { normClient, prefixForClient, channelForCanal } from "./tiendasConfig";

test("normClient: mayúsculas, sin acentos/apóstrofes, espacios colapsados", () => {
  assert.equal(normClient(" Plaza´s "), "PLAZAS");
  assert.equal(normClient("Central  Madeirense"), "CENTRAL MADEIRENSE");
  assert.equal(normClient("FARMATODO,C.A."), "FARMATODO,C.A.");
});

test("prefixForClient: mapa cerrado, tolera variantes", () => {
  assert.equal(prefixForClient("FARMATODO,C.A."), "FTD");
  assert.equal(prefixForClient("FARMATODO, C.A."), "FTD");
  assert.equal(prefixForClient("PLAZA´S"), "PLAZA'S");
  assert.equal(prefixForClient("CENTRAL MADEIRENSE"), "CMD");
  assert.equal(prefixForClient("RIO SUPERMARKET"), "RIO");
  assert.equal(prefixForClient("RIO VIDA"), "RIO VIDA");
  assert.equal(prefixForClient("DESCONOCIDO"), null);
});

test("channelForCanal", () => {
  assert.equal(channelForCanal("Cadenas de Farmacias"), "farmacia");
  assert.equal(channelForCanal("Cadenas de Supermercados"), "supermercado");
  assert.equal(channelForCanal("Supermercado independiente"), "supermercado");
  assert.equal(channelForCanal("Importadora"), "otro");
  assert.equal(channelForCanal("Perfumeria"), "otro");
});
