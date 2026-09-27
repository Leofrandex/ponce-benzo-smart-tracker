import { test } from "node:test";
import assert from "node:assert/strict";
import { buildVendorRows, vendorOptions, diffAssignments, type ConfigUser } from "./config";

const clients = [
  { client_id: "c2", name: "LOCATEL", business_channel: null, store_count: 9 },
  { client_id: "c1", name: "FARMATODO", business_channel: null, store_count: 60 },
  { client_id: "c3", name: "HUMMY", business_channel: null, store_count: 1 },
];
const users: ConfigUser[] = [
  { id: "u-betsy", full_name: "Betsy Castro", role: "vendedor", active: true },
  { id: "u-juan",  full_name: "Juan León",    role: "vendedor", active: true },
  { id: "u-old",   full_name: "Ex Vendedor",  role: "vendedor", active: false },
  { id: "u-elvis", full_name: "Elvis Rondón", role: "merchandiser", active: true },
];

test("buildVendorRows ordena por nombre y resuelve personas asignadas, incluido un mercaderista", () => {
  const rows = buildVendorRows(clients, [
    { client_id: "c1", user_id: "u-betsy" },
    { client_id: "c1", user_id: "u-elvis" },
    { client_id: "c2", user_id: "u-juan" },
  ], users);
  assert.deepEqual(rows.map((r) => r.name), ["FARMATODO", "HUMMY", "LOCATEL"]);
  assert.deepEqual(rows[0].assigned, [
    { user_id: "u-betsy", full_name: "Betsy Castro", role: "vendedor" },
    { user_id: "u-elvis", full_name: "Elvis Rondón", role: "merchandiser" },
  ]);
  assert.deepEqual(rows[1].assigned, []);
});

test("buildVendorRows no pierde una asignación a un usuario desconocido", () => {
  const rows = buildVendorRows(clients, [{ client_id: "c3", user_id: "u-ghost" }], users);
  assert.deepEqual(rows.find((r) => r.client_id === "c3")!.assigned, [
    { user_id: "u-ghost", full_name: "(usuario desconocido)", role: "" },
  ]);
});

test("vendorOptions: vendedores activos más cualquier persona ya asignada, con su rol si no es vendedor", () => {
  const rows = buildVendorRows(clients, [{ client_id: "c1", user_id: "u-elvis" }, { client_id: "c2", user_id: "u-old" }], users);
  assert.deepEqual(vendorOptions(users, rows), [
    { value: "u-betsy", label: "Betsy Castro" },
    { value: "u-elvis", label: "Elvis Rondón (Mercaderista)" },
    { value: "u-old",   label: "Ex Vendedor (inactivo)" },
    { value: "u-juan",  label: "Juan León" },
  ]);
});

test("vendorOptions: un usuario asignado que no existe en users también aparece, para no mostrar su UUID en el chip", () => {
  const rows = buildVendorRows(clients, [{ client_id: "c3", user_id: "u-ghost" }], users);
  const opt = vendorOptions(users, rows).find((o) => o.value === "u-ghost");
  assert.deepEqual(opt, { value: "u-ghost", label: "(usuario desconocido)" });
});

test("diffAssignments calcula altas y bajas sin tocar lo que no cambió", () => {
  assert.deepEqual(diffAssignments(["a", "b"], ["b", "c"]), { toAdd: ["c"], toRemove: ["a"] });
  assert.deepEqual(diffAssignments(["a"], ["a"]), { toAdd: [], toRemove: [] });
  assert.deepEqual(diffAssignments([], ["a", "a"]), { toAdd: ["a"], toRemove: [] });
});
