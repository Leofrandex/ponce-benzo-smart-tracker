import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveGeoOptions, EMPTY_GEO, type GeoItem } from "./geoOptions";

const ITEMS: GeoItem[] = [
  { estado: "Miranda",  municipio: "Chacao",   urbanizacion: "Altamira" },
  { estado: "Miranda",  municipio: "Chacao",   urbanizacion: "La Castellana" },
  { estado: "Miranda",  municipio: "Baruta",   urbanizacion: "Las Mercedes" },
  { estado: "Carabobo", municipio: "Valencia", urbanizacion: "El Viñedo" },
  { estado: null,       municipio: null,       urbanizacion: null },
];

test("deriveGeoOptions: sin filtro lista estados únicos y ordenados, sin nulls", () => {
  const r = deriveGeoOptions(ITEMS, EMPTY_GEO);
  assert.deepEqual(r.estados, ["Carabobo", "Miranda"]);
});

test("deriveGeoOptions: municipios se filtran por estado seleccionado", () => {
  const r = deriveGeoOptions(ITEMS, { ...EMPTY_GEO, estado: "Miranda" });
  assert.deepEqual(r.municipios, ["Baruta", "Chacao"]);
});

test("deriveGeoOptions: urbanizaciones se filtran por estado + municipio", () => {
  const r = deriveGeoOptions(ITEMS, { estado: "Miranda", municipio: "Chacao", urbanizacion: "" });
  assert.deepEqual(r.urbanizaciones, ["Altamira", "La Castellana"]);
});
