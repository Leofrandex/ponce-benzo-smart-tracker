import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mapRestockRows, ultimaReposicion, haceTexto, validarFechaReposicion, mensajeError, type RawRestock,
} from "./restocks";
import { canRegisterRestock } from "../roles";

const raw = (over: Partial<RawRestock> = {}): RawRestock => ({
  restock_id: "r1", restock_date: "2026-09-20", source: "app", note: null, created_by: "u1",
  users: { full_name: "Ana Pérez" },
  restock_products: [{ products: { product_id: "p1", name: "Centrum", brand: "Pfizer" } }],
  ...over,
});

test("mapRestockRows aplana autor y productos", () => {
  const [r] = mapRestockRows([raw()]);
  assert.equal(r.autor, "Ana Pérez");
  assert.deepEqual(r.productos, [{ product_id: "p1", name: "Centrum", brand: "Pfizer" }]);
});

test("mapRestockRows tolera autor nulo, productos vacíos y producto borrado", () => {
  const [r] = mapRestockRows([raw({ users: null, restock_products: [{ products: null }] })]);
  assert.equal(r.autor, null);
  assert.deepEqual(r.productos, []);
});

test("mapRestockRows ordena productos por nombre", () => {
  const [r] = mapRestockRows([raw({ restock_products: [
    { products: { product_id: "b", name: "Zinc", brand: null } },
    { products: { product_id: "a", name: "Ácido fólico", brand: null } },
  ] })]);
  assert.deepEqual(r.productos.map((p) => p.product_id), ["a", "b"]);
});

test("ultimaReposicion toma la fecha mayor, sin importar el orden", () => {
  const rows = mapRestockRows([raw({ restock_date: "2026-09-01" }), raw({ restock_id: "r2", restock_date: "2026-09-15" })]);
  assert.equal(ultimaReposicion(rows), "2026-09-15");
});

test("ultimaReposicion sin filas es null", () => {
  assert.equal(ultimaReposicion([]), null);
});

test("haceTexto: hoy, ayer y días", () => {
  assert.equal(haceTexto(0), "Hoy");
  assert.equal(haceTexto(1), "Ayer");
  assert.equal(haceTexto(12), "Hace 12 días");
});

test("validarFechaReposicion: vacía, futura y válida", () => {
  assert.equal(validarFechaReposicion("", "2026-09-27"), "Elige la fecha de la reposición.");
  assert.equal(validarFechaReposicion("2026-09-28", "2026-09-27"), "La fecha no puede ser posterior a hoy.");
  assert.equal(validarFechaReposicion("2026-09-27", "2026-09-27"), null);
});

test("mensajeError traduce RLS y fecha futura; deja pasar lo demás", () => {
  assert.equal(mensajeError('new row violates row-level security policy for table "restocks"'),
    "No tienes permiso para registrar reposiciones en esta tienda.");
  assert.equal(mensajeError("fecha_futura"), "La fecha no puede ser posterior a hoy.");
  assert.equal(mensajeError("Failed to fetch"), "Failed to fetch");
});

test("canRegisterRestock: solo admin y vendedor", () => {
  assert.equal(canRegisterRestock("admin"), true);
  assert.equal(canRegisterRestock("vendedor"), true);
  assert.equal(canRegisterRestock("merchandiser"), false);
  assert.equal(canRegisterRestock("colaborador"), false);
  assert.equal(canRegisterRestock(null), false);
});
