import { test } from "node:test";
import assert from "node:assert/strict";
import {
  linkMercaderistas, linkMercaderista, linkTareasAnomalias, linkTareasAbiertas, linkTareasViejas,
  linkTareasTramo, linkCadena, linkTienda, linkSinVendedor,
} from "./dashboardLinks";
import { parseTaskParams } from "./taskUrl";

const qs = (href: string) => new URLSearchParams(href.split("?")[1] ?? "");

test("mercaderistas y perfil llevan el periodo", () => {
  assert.equal(linkMercaderistas("2026-09-21", "2026-09-27"), "/panel/mercaderistas?desde=2026-09-21&hasta=2026-09-27");
  assert.equal(linkMercaderista("u1", "2026-09-21", "2026-09-27"), "/panel/mercaderistas/u1?desde=2026-09-21&hasta=2026-09-27");
});

test("anomalías: tipo concreto o cualquiera, todas las del periodo", () => {
  const f = parseTaskParams(qs(linkTareasAnomalias("sin_stock", "2026-09-21", "2026-09-27")));
  assert.equal(f.status, "all");
  assert.equal(f.anomalia, "sin_stock");
  assert.equal(f.desde, "2026-09-21");
  assert.equal(f.hasta, "2026-09-27");
  assert.equal(parseTaskParams(qs(linkTareasAnomalias(null, "2026-09-21", "2026-09-27"))).anomalia, "cualquiera");
});

test("tareas abiertas, viejas y por tramo (el +30 de la base viaja como 30+)", () => {
  assert.equal(linkTareasAbiertas(), "/panel/tareas");
  assert.deepEqual(parseTaskParams(qs(linkTareasViejas())).antiguedad, ["16-30", "30+"]);
  assert.deepEqual(parseTaskParams(qs(linkTareasTramo("+30"))).antiguedad, ["30+"]);
  assert.deepEqual(parseTaskParams(qs(linkTareasTramo("8-15"))).antiguedad, ["8-15"]);
  assert.equal(parseTaskParams(qs(linkTareasTramo("8-15"))).status, "open");
});

test("cadena sin id no es enlace; tienda y sin-vendedor", () => {
  assert.equal(linkCadena("c1"), "/panel/tiendas?client=c1");
  assert.equal(linkCadena(null), null);
  assert.equal(linkTienda("s1"), "/panel/tiendas/s1");
  assert.equal(linkSinVendedor(), "/panel/configuracion/vendedores?filtro=sin-vendedor");
});
