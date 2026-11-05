import { test } from "node:test";
import * as assert from "node:assert/strict";
import { leerLista, parseLista, planificar, resolverCodigos } from "./backfill-pdv-codes";

test("resolverCodigos: dos códigos para una tienda, gana el menor", () => {
  const r = resolverCodigos({ "PDV-0585": "s1", "PDV-0100": "s1", "PDV-0200": "s2" });
  assert.equal(r.principal.get("s1"), "PDV-0100");
  assert.equal(r.principal.get("s2"), "PDV-0200");
  assert.deepEqual(r.alias, [{ code: "PDV-0585", store_id: "s1" }]);
});

test("resolverCodigos: compara por número, no por texto", () => {
  const r = resolverCodigos({ "PDV-10000": "s1", "PDV-9999": "s1" });
  assert.equal(r.principal.get("s1"), "PDV-9999");
  assert.deepEqual(r.alias, [{ code: "PDV-10000", store_id: "s1" }]);
});

const tienda = (store_id: string, pdv_code: string | null = null) => ({ store_id, pdv_code });
const RESERVADO = { code: "PDV-0194", store_id: null, kind: "reservado", note: "Excelsior Gama, sin sucursal" };

test("planificar: base vacía, escribe principales y alias, y siempre el reservado", () => {
  const p = planificar({ "PDV-0100": "s1", "PDV-0585": "s1", "PDV-0200": "s2" }, [tienda("s1"), tienda("s2"), tienda("s3")], []);
  assert.deepEqual(p.escribir, [{ store_id: "s1", code: "PDV-0100" }, { store_id: "s2", code: "PDV-0200" }]);
  assert.deepEqual(p.alias, [{ code: "PDV-0585", store_id: "s1", kind: "alias", note: null }]);
  assert.deepEqual(p.reservados, [RESERVADO]);
  assert.equal(p.sinCodigo, 1);
  assert.deepEqual(p.conflictos, []);
  assert.deepEqual(p.inexistentes, []);
});

test("planificar: repetir después de escribir no cambia nada", () => {
  const p = planificar({ "PDV-0100": "s1", "PDV-0585": "s1" }, [tienda("s1", "PDV-0100")], [
    { code: "PDV-0585", store_id: "s1", kind: "alias" }, { code: "PDV-0194", store_id: null, kind: "reservado" },
  ]);
  assert.deepEqual(p.escribir, []);
  assert.deepEqual(p.conflictos, []);
  assert.equal(p.sinCodigo, 0);
  // Lo ya registrado no se vuelve a enviar.
  assert.deepEqual(p.alias, []);
  assert.deepEqual(p.reservados, []);
});

test("planificar: código que ya tiene otra tienda se reporta y no se escribe", () => {
  const p = planificar({ "PDV-0100": "s1" }, [tienda("s1"), tienda("s2", "PDV-0100")], []);
  assert.deepEqual(p.escribir, []);
  assert.equal(p.conflictos.length, 1);
  assert.match(p.conflictos[0], /PDV-0100.*s2/);
});

test("planificar: alias que ya tiene otra tienda se reporta y no se registra", () => {
  const p = planificar({ "PDV-0100": "s1", "PDV-0585": "s1" }, [tienda("s1"), tienda("s2", "PDV-0585")], []);
  assert.deepEqual(p.alias, []);
  assert.equal(p.conflictos.length, 1);
});

test("planificar: código ya registrado como alias de otra tienda o reservado no se pisa", () => {
  const p = planificar({ "PDV-0100": "s1", "PDV-0194": "s2", "PDV-0300": "s1" }, [tienda("s1"), tienda("s2")], [
    { code: "PDV-0300", store_id: "s9", kind: "alias" }, { code: "PDV-0194", store_id: null, kind: "reservado" },
  ]);
  assert.deepEqual(p.escribir, [{ store_id: "s1", code: "PDV-0100" }]);
  assert.deepEqual(p.alias, []);
  assert.equal(p.conflictos.length, 2);
});

test("planificar: tienda con otro código no se pisa; el del JSON pasa a alias", () => {
  const p = planificar({ "PDV-0100": "s1" }, [tienda("s1", "PDV-1001")], []);
  assert.deepEqual(p.escribir, []);
  assert.deepEqual(p.alias.map((a) => [a.code, a.store_id]), [["PDV-0100", "s1"]]);
});

test("planificar: el alias igual al código que ya tiene su tienda no se registra", () => {
  const p = planificar({ "PDV-0100": "s1", "PDV-0585": "s1" }, [tienda("s1", "PDV-0585")], []);
  assert.deepEqual(p.escribir, []);
  assert.deepEqual(p.alias.map((a) => a.code), ["PDV-0100"]);
  assert.deepEqual(p.conflictos, []);
});

test("planificar: tienda inexistente se reporta, con principal y con alias", () => {
  const p = planificar({ "PDV-0100": "nada", "PDV-0585": "nada" }, [tienda("s1")], []);
  assert.deepEqual(p.escribir, []);
  assert.deepEqual(p.alias, []);
  assert.deepEqual(p.inexistentes, ["PDV-0100 -> nada", "PDV-0585 -> nada"]);
});

test("planificar: reservado que una tienda ya usa se reporta y no se registra", () => {
  const p = planificar({}, [tienda("s1", "PDV-0194")], []);
  assert.deepEqual(p.reservados, []);
  assert.equal(p.conflictos.length, 1);
});

test("parseLista: separador ; o coma, BOM y columnas extra", () => {
  assert.deepEqual(parseLista("﻿ID_PDV;Tienda;store_id\r\nPDV-0001;A;s1\r\n").mapa, { "PDV-0001": "s1" });
  assert.deepEqual(parseLista("store_id,ID_PDV\ns1,PDV-0001\ns2,PDV-0002\n").mapa, { "PDV-0001": "s1", "PDV-0002": "s2" });
});

test("parseLista: sin las columnas o con un código en dos tiendas, error claro", () => {
  assert.throws(() => parseLista("ID_PDV;Tienda\nPDV-0001;A\n"), /ID_PDV y store_id/);
  assert.throws(() => parseLista("ID_PDV;store_id\nPDV-0001;s1\nPDV-0001;s2\n"), /PDV-0001/);
});

test("parseLista: pasa a mayúsculas antes de validar", () => {
  const r = parseLista("ID_PDV;store_id\npdv-0001;s1\n");
  assert.deepEqual(r.mapa, { "PDV-0001": "s1" });
  assert.deepEqual(r.saltadas, []);
});

test("parseLista: código mal formado se salta con su fila del archivo", () => {
  const r = parseLista("ID_PDV;store_id\nPDV-0001;s1\nABC;s2\nPDV-12;s3\n");
  assert.deepEqual(r.mapa, { "PDV-0001": "s1" });
  assert.equal(r.saltadas.length, 2);
  assert.match(r.saltadas[0], /^fila 3: .*ABC/);
  assert.match(r.saltadas[1], /^fila 4: .*PDV-12/);
});

test("parseLista: filas cortas o incompletas se reportan, las vacías se ignoran, y la numeración sigue el archivo", () => {
  const r = parseLista("ID_PDV;Tienda;store_id\nPDV-0001;A\n\n;;\nPDV-0002;B;\n;B;s9\nPDV-0003;C;s3\nXX;C;s4\n");
  assert.deepEqual(r.mapa, { "PDV-0003": "s3" });
  assert.deepEqual(r.saltadas.map((x) => x.split(":")[0]), ["fila 2", "fila 5", "fila 6", "fila 8"]);
});

test("planificar: código mal formado del mapa nunca llega a una escritura", () => {
  const p = planificar({ "ABC": "s1", "pdv-0001": "s1", "PDV-0100": "s1", "PDV-12": "s2" }, [tienda("s1"), tienda("s2")], []);
  assert.deepEqual(p.escribir, [{ store_id: "s1", code: "PDV-0100" }]);
  assert.deepEqual(p.alias, []);
  assert.deepEqual(p.malformados, ["ABC -> s1", "pdv-0001 -> s1", "PDV-12 -> s2"]);
  assert.equal(p.sinCodigo, 1);
});

test("planificar: alias y reservado ya registrados no se reenvían, para no pisar kind ni note", () => {
  const p = planificar({ "PDV-0100": "s1", "PDV-0585": "s1" }, [tienda("s1")], [
    { code: "PDV-0585", store_id: "s1", kind: "reservado" }, { code: "PDV-0194", store_id: null, kind: "reservado" },
  ]);
  assert.deepEqual(p.escribir, [{ store_id: "s1", code: "PDV-0100" }]);
  assert.deepEqual(p.alias, []);
  assert.deepEqual(p.reservados, []);
  assert.deepEqual(p.conflictos, []);
});

test("leerLista: archivo que no existe, error con la ruta", () => {
  assert.throws(() => leerLista("no/existe.csv"), /No existe el archivo de --lista: no\/existe\.csv/);
});
