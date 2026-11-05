import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCoords, mensajeErrorAltaTienda } from "./stores";

test("validateCoords acepta coordenadas válidas y rechaza fuera de rango / NaN", () => {
  assert.equal(validateCoords(10.4806, -66.9036), true);
  assert.equal(validateCoords(0, 0), true);
  assert.equal(validateCoords(91, 0), false);
  assert.equal(validateCoords(0, 181), false);
  assert.equal(validateCoords(-91, 0), false);
  assert.equal(validateCoords(NaN, 0), false);
  assert.equal(validateCoords(10, Infinity), false);
});

test("mensajeErrorAltaTienda: 23505 se traduce; otros errores pasan tal cual", () => {
  assert.equal(mensajeErrorAltaTienda({ code: "23505", message: "duplicate key value violates unique constraint" }),
    "Ya existe una tienda con ese código PDV.");
  assert.equal(mensajeErrorAltaTienda({ code: "42501", message: "permiso denegado" }), "permiso denegado");
});
