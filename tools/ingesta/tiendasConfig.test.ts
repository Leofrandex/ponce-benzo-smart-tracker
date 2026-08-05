// tools/ingesta/tiendasConfig.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { normClient, prefixForClient, channelForCanal, fixStoreName } from "./tiendasConfig";

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

test("fixStoreName: corrige typos del Excel confirmados con el cliente", () => {
  // El Excel del 2026-08-05 trae "PLAZA LAS AMERICA"; el cliente confirmó que
  // el nombre correcto lleva S final.
  assert.equal(fixStoreName("CENTRAL MADEIRENSE", "PLAZA LAS AMERICA"), "PLAZA LAS AMERICAS");
  // Idempotente: el nombre ya correcto no se toca.
  assert.equal(fixStoreName("CENTRAL MADEIRENSE", "PLAZA LAS AMERICAS"), "PLAZA LAS AMERICAS");
  // El fix es por cliente: no se aplica a otra cadena.
  assert.equal(fixStoreName("GAMA", "PLAZA LAS AMERICA"), "PLAZA LAS AMERICA");
  // Nombres sin fix pasan tal cual.
  assert.equal(fixStoreName("CENTRAL MADEIRENSE", "MONTALBAN"), "MONTALBAN");
});

test("channelForCanal", () => {
  assert.equal(channelForCanal("Cadenas de Farmacias"), "farmacia");
  assert.equal(channelForCanal("Cadenas de Supermercados"), "supermercado");
  assert.equal(channelForCanal("Supermercado independiente"), "supermercado");
  assert.equal(channelForCanal("Importadora"), "otro");
  assert.equal(channelForCanal("Perfumeria"), "otro");
});
