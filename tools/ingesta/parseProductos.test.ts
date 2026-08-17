import { test } from "node:test";
import assert from "node:assert/strict";
import { derivarMarca, repararTexto } from "./parseProductos";

test("derivarMarca reconoce las variantes del prefijo Dioxogen", () => {
  assert.equal(derivarMarca("DIOX. GEL ANTIB REFRESC 230X12"), "Dioxogen");
  assert.equal(derivarMarca("DIOXOGEN ROLL ON ORIGINAL 50X12"), "Dioxogen");
  assert.equal(derivarMarca("DIOX INTEN C GEL D DUCHA HIP 280X12"), "Dioxogen");
});

test("derivarMarca reconoce las variantes del prefijo Dencorub", () => {
  assert.equal(derivarMarca("DENCORUB ICE(40X24)"), "Dencorub");
  assert.equal(derivarMarca("DENCO ICE SPRAY 120X12"), "Dencorub");
});

test("derivarMarca cubre el resto del catalogo", () => {
  assert.equal(derivarMarca("OVERSKIN ANTI CREMA TUBO 50X12"), "Overskin");
  assert.equal(derivarMarca("PHFEM GEL INTIMO DELICADO 280X12"), "PHFem");
  assert.equal(derivarMarca("VITENOL CREMA 15X24"), "Vitenol");
  assert.equal(derivarMarca("ADEL UNGUENTO 50X12"), "Adel");
  assert.equal(derivarMarca("WAMPOLE EMULS FRESA 360X6"), "Wampole");
});

test("derivarMarca devuelve null si no reconoce el prefijo", () => {
  assert.equal(derivarMarca("PRODUCTO NUEVO SIN MARCA CONOCIDA"), null);
});

test("repararTexto arregla la codificacion rota del Excel", () => {
  assert.equal(
    repararTexto("OVERSKIN 2 EN 1 CHAMPU Y GEL DE BA\uFFFDO 280 X12"),
    "OVERSKIN 2 EN 1 CHAMPU Y GEL DE BAÑO 280 X12",
  );
});

test("repararTexto colapsa espacios y recorta los extremos", () => {
  assert.equal(repararTexto("  DIOX.ROLL   ORIG 90X36  "), "DIOX.ROLL ORIG 90X36");
});
