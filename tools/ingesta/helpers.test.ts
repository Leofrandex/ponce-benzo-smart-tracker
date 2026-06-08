// tools/ingesta/helpers.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { channelForStore, referenceWeekDates, cleanStoreName, storeKey } from "./helpers";

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

test("referenceWeekDates devuelve Lun..Vie desde el lunes en/después de la fecha dada", () => {
  // 2026-06-08 es lunes
  assert.deepEqual(referenceWeekDates(new Date("2026-06-08T12:00:00Z")), [
    "2026-06-08", "2026-06-09", "2026-06-10", "2026-06-11", "2026-06-12",
  ]);
  // 2026-06-10 es miércoles -> siguiente lunes es 2026-06-15
  assert.deepEqual(referenceWeekDates(new Date("2026-06-10T12:00:00Z")), [
    "2026-06-15", "2026-06-16", "2026-06-17", "2026-06-18", "2026-06-19",
  ]);
});
