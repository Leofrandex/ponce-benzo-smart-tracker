import { test } from "node:test";
import assert from "node:assert/strict";
import { normTexto, normRif } from "./normalizar";
import { validarTiendas, validarClientes, type CtxTiendas } from "./validar";

const base = { cliente: "Gama", nombre: "Tienda", canal: "farmacia", estado: "Miranda", municipio: "Chacao", direccion: "Av 1" };
const fila = (n: number, o: Record<string, string>) => ({ fila: n, valores: { ...base, ...o } });
const baseC = { nombre: "Cli", canal: "otro" };
const filaC = (n: number, o: Record<string, string>) => ({ fila: n, valores: { ...baseC, ...o } });

const ctxConGamaChuao: CtxTiendas = {
  clientes: [{ client_id: "g", name: "Gama" }, { client_id: "l", name: "Locatel" }],
  tiendas: [{ client_id: "g", name: "Gama Chuao", pdv_code: "PDV-0338" }],
  codigos: [],
};
const ctxConAlias: CtxTiendas = { ...ctxConGamaChuao, codigos: [{ code: "PDV-0585", kind: "alias" }, { code: "PDV-0194", kind: "reservado" }] };

test("normTexto: acentos, mayúsculas y espacios", () => {
  assert.equal(normTexto("  FTD   Ofélia "), "ftd ofelia");
});
test("normTexto: ñ, espacio duro y caracter fuera de la tabla", () => {
  assert.equal(normTexto("NÚÑEZ"), "nunez");
  assert.equal(normTexto("a  b"), "a b");
  assert.equal(normTexto("À"), "à");
});
test("normRif: solo alfanuméricos en mayúscula", () => {
  assert.equal(normRif("j-12345678-9"), "J123456789");
  assert.equal(normRif(" - "), "");
});
test("tienda: mismo cliente y nombre sin acentos es repetida", () => {
  assert.equal(validarTiendas([fila(2, { cliente: "gama", nombre: "GAMA CHÚAO" })], ctxConGamaChuao)[0].estado, "repetida");
});
test("tienda: mismo nombre en otro cliente no es repetida", () => {
  assert.equal(validarTiendas([fila(2, { cliente: "Locatel", nombre: "Gama Chuao" })], ctxConGamaChuao)[0].estado, "lista");
});
test("tienda: código existente es repetida aunque cambie el nombre", () => {
  assert.equal(validarTiendas([fila(2, { nombre: "Otra", pdv: "pdv-0338" })], ctxConGamaChuao)[0].estado, "repetida");
});
test("tienda: alias es repetida, reservado es error", () => {
  assert.equal(validarTiendas([fila(2, { nombre: "X", pdv: "PDV-0585" })], ctxConAlias)[0].estado, "repetida");
  assert.equal(validarTiendas([fila(2, { nombre: "X", pdv: "PDV-0194" })], ctxConAlias)[0].estado, "error");
});
test("tienda: repetida dentro del mismo archivo, entra solo la primera", () => {
  const r = validarTiendas([fila(2, { nombre: "Nueva Uno" }), fila(3, { nombre: "NUEVA  ÚNO" })], ctxConGamaChuao);
  assert.deepEqual(r.map((x) => x.estado), ["lista", "repetida"]);
});
test("tienda: una fila con error no reserva su clave", () => {
  const r = validarTiendas([fila(2, { nombre: "Nueva", canal: "bodega" }), fila(3, { nombre: "Nueva" })], ctxConGamaChuao);
  assert.deepEqual(r.map((x) => x.estado), ["error", "lista"]);
});
test("tienda: cliente inexistente es error y no se crea", () => {
  const r = validarTiendas([fila(2, { cliente: "GAMMA", nombre: "A" })], ctxConGamaChuao);
  assert.match((r[0] as { errores: string[] }).errores[0], /GAMMA/);
});
test("tienda: cliente ambiguo es error", () => {
  const ctx = { ...ctxConGamaChuao, clientes: [...ctxConGamaChuao.clientes, { client_id: "g2", name: "GAMÁ" }] };
  assert.match((validarTiendas([fila(2, { nombre: "A" })], ctx)[0] as { errores: string[] }).errores[0], /Cliente ambiguo: Gama/);
});
test("tienda: faltantes, canal inválido y formato de código se reportan juntos", () => {
  const r = validarTiendas([fila(2, { municipio: "", canal: "bodega", pdv: "123" })], ctxConGamaChuao);
  assert.equal((r[0] as { errores: string[] }).errores.length, 3);
});
test("tienda: canal se acepta por etiqueta o valor, sin acentos", () => {
  assert.equal(validarTiendas([fila(2, { nombre: "A", canal: "Droguería" })], ctxConGamaChuao)[0].estado, "lista");
  assert.equal(validarTiendas([fila(2, { nombre: "B", canal: "drogueria" })], ctxConGamaChuao)[0].estado, "lista");
});
test("tienda: coma decimal se interpreta", () => {
  const r = validarTiendas([fila(2, { nombre: "A", latitud: "10,48", longitud: "-66,90" })], ctxConGamaChuao);
  assert.equal((r[0] as { datos: { master_lat: number } }).datos.master_lat, 10.48);
});
test("tienda: solo latitud o fuera de rango es error", () => {
  assert.equal(validarTiendas([fila(2, { nombre: "A", latitud: "10" })], ctxConGamaChuao)[0].estado, "error");
  assert.equal(validarTiendas([fila(2, { nombre: "B", latitud: "200", longitud: "1" })], ctxConGamaChuao)[0].estado, "error");
});
test("cliente: repetido por nombre o por RIF normalizado", () => {
  const ctx = { clientes: [{ name: "Gama", rif: "J-12345678-9" }], vendedores: [] };
  assert.equal(validarClientes([filaC(2, { nombre: "GAMÁ", canal: "otro" })], ctx)[0].estado, "repetida");
  assert.equal(validarClientes([filaC(2, { nombre: "Otro", canal: "otro", rif: "j123456789" })], ctx)[0].estado, "repetida");
});
test("cliente: vendedor que no es activo es error", () => {
  const r = validarClientes([filaC(2, { nombre: "X", canal: "otro", vendedor: "Nadie" })], { clientes: [], vendedores: [] });
  assert.equal(r[0].estado, "error");
});
test("cliente: vendedor activo se resuelve por nombre normalizado", () => {
  const r = validarClientes([filaC(2, { nombre: "X", vendedor: "jose perez" })], { clientes: [], vendedores: [{ user_id: "u1", full_name: "José Pérez" }] });
  assert.equal((r[0] as { datos: { vendedor_id: string } }).datos.vendedor_id, "u1");
});
