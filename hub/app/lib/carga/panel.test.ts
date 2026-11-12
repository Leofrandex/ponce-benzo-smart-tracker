import { test } from "node:test";
import assert from "node:assert/strict";
import { agrupar, textoResumen, etiquetaCargar, payloadTiendas, payloadClientes, repetidasConNombre } from "./panel";
import type { Clasificada } from "./validar";
import type { TiendaInput, ClienteInput } from "../types";

const t: TiendaInput = { client_id: "g", name: "A", business_channel: "farmacia", estado: "M", municipio: "C", address: "x", master_lat: 10, master_lng: -66, pdv_code: "PDV-0001" };
const filas: Clasificada<TiendaInput>[] = [
  { fila: 2, nombre: "A", estado: "lista", datos: t },
  { fila: 3, nombre: "B", estado: "repetida", motivo: "ya" },
  { fila: 4, nombre: "C", estado: "error", errores: ["e"] },
  { fila: 5, nombre: "D", estado: "lista", datos: { ...t, name: "D" } },
];

test("agrupar separa por estado y conserva el numero de fila", () => {
  const g = agrupar(filas);
  assert.deepEqual(g.listas.map((f) => f.fila), [2, 5]);
  assert.deepEqual(g.repetidas.map((f) => f.fila), [3]);
  assert.deepEqual(g.errores.map((f) => f.fila), [4]);
});
test("textoResumen con plurales", () => {
  assert.equal(textoResumen({ listas: 18, repetidas: 4, errores: 2 }), "18 listas para cargar · 4 repetidas · 2 con errores");
  assert.equal(textoResumen({ listas: 1, repetidas: 1, errores: 1 }), "1 lista para cargar · 1 repetida · 1 con error");
});
test("etiquetaCargar singular y plural", () => {
  assert.equal(etiquetaCargar("tiendas", 1), "Cargar 1 tienda");
  assert.equal(etiquetaCargar("tiendas", 18), "Cargar 18 tiendas");
  assert.equal(etiquetaCargar("clientes", 1), "Cargar 1 cliente");
  assert.equal(etiquetaCargar("clientes", 0), "Cargar 0 clientes");
});
test("payloadTiendas manda fila y campos opcionales como null", () => {
  const p = payloadTiendas([{ fila: 2, datos: { ...t, master_lat: undefined, master_lng: undefined, pdv_code: undefined } }]);
  assert.equal(p[0].fila, 2);
  assert.equal(p[0].master_lat, null);
  assert.equal(p[0].pdv_code, null);
  assert.equal(p[0].urbanizacion, null);
});
test("payloadClientes", () => {
  const d: ClienteInput = { name: "X", business_channel: "otro", vendedor_id: "u1" };
  assert.deepEqual(payloadClientes([{ fila: 7, datos: d }]), [{ fila: 7, name: "X", business_channel: "otro", rif: null, vendedor_id: "u1" }]);
});
test("repetidasConNombre une el nombre por numero de fila", () => {
  const r = repetidasConNombre([{ fila: 3, motivo: "m" }, { fila: 99, motivo: "z" }], filas);
  assert.deepEqual(r, [{ fila: 3, nombre: "B", motivo: "m" }, { fila: 99, nombre: "", motivo: "z" }]);
});
