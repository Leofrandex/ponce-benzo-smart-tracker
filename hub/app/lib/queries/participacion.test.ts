import { test } from "node:test";
import assert from "node:assert/strict";
import { etiquetaParticipacion, totalVisitas } from "./participacion";

test("etiquetaParticipacion: redondea sobre el total", () => {
  assert.equal(etiquetaParticipacion(294, 750), "294 · 39%");
});
test("etiquetaParticipacion: total cero no produce NaN", () => {
  assert.equal(etiquetaParticipacion(0, 0), "0 · 0%");
});
test("etiquetaParticipacion: una sola cadena es 100%", () => {
  assert.equal(etiquetaParticipacion(5, 5), "5 · 100%");
});
test("totalVisitas suma BigInt-como-texto o número", () => {
  assert.equal(totalVisitas([{ visitas: 3 }, { visitas: Number("7") }]), 10);
});
