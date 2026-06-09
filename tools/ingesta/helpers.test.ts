// tools/ingesta/helpers.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { channelForStore, dateForRuta, cleanStoreName, storeKey } from "./helpers";

test("channelForStore mapea cadenas conocidas y typos", () => {
  assert.equal(channelForStore("FTD LOS MONJES"), "farmacia");
  assert.equal(channelForStore("FTO ROBLE"), "farmacia");      // typo Farmatodo
  assert.equal(channelForStore("TDF PRADOS"), "farmacia");     // typo Farmatodo
  assert.equal(channelForStore("LOCATEL CARICUAO"), "farmacia");
  assert.equal(channelForStore("GAMA BOLEITA"), "supermercado");
  assert.equal(channelForStore("PLAZA LA LAGUNITA"), "supermercado");
  assert.equal(channelForStore("PLAZAS LOS SAMANES"), "supermercado");
  assert.equal(channelForStore("RED VITAL GUARENAS"), "otro");
  assert.equal(channelForStore("EMPORIUM C.C MIRANDA"), "otro");
});

test("cleanStoreName recorta y colapsa espacios sin tocar typos", () => {
  assert.equal(cleanStoreName("LOCATEL SAN MARTIN "), "LOCATEL SAN MARTIN");
  assert.equal(cleanStoreName("FTD  LOS   MONJES"), "FTD LOS MONJES");
  assert.equal(cleanStoreName("FTO ROBLE"), "FTO ROBLE"); // typo intacto
});

test("storeKey es case-insensitive y estable", () => {
  assert.equal(storeKey("FTD Los Monjes "), storeKey("ftd  los monjes"));
});

test("dateForRuta ancla al lunes de la semana actual; Ruta 1-5 esta semana, 6-10 la siguiente", () => {
  const martes = new Date("2026-06-09T12:00:00Z"); // martes
  assert.equal(dateForRuta(1, martes), "2026-06-08");  // Lun
  assert.equal(dateForRuta(2, martes), "2026-06-09");  // Mar (hoy)
  assert.equal(dateForRuta(5, martes), "2026-06-12");  // Vie
  assert.equal(dateForRuta(6, martes), "2026-06-15");  // Lun (sem. siguiente)
  assert.equal(dateForRuta(10, martes), "2026-06-19"); // Vie (sem. siguiente)
  // domingo cuenta dentro de la semana que empezó el lunes anterior
  assert.equal(dateForRuta(1, new Date("2026-06-14T12:00:00Z")), "2026-06-08");
});
