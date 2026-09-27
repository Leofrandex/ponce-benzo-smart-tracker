import { test } from "node:test";
import assert from "node:assert/strict";
import { saveClientVendorsWith, type AssignmentsClient } from "./assignments";

function fakeDb(opts: { insertError?: string; removeError?: string } = {}) {
  const calls: string[] = [];
  const db: AssignmentsClient = {
    insert: async (rows) => { calls.push(`insert:${rows.map((r) => r.user_id).join(",")}`); return { error: opts.insertError ? { message: opts.insertError } : null }; },
    remove: async (clientId, ids) => { calls.push(`remove:${clientId}:${ids.join(",")}`); return { error: opts.removeError ? { message: opts.removeError } : null }; },
  };
  return { db, calls };
}

test("inserta antes de borrar, para no dejar la cadena sin nadie si algo falla a mitad", async () => {
  const { db, calls } = fakeDb();
  const r = await saveClientVendorsWith(db, "c1", ["a", "b"], ["b", "c"]);
  assert.deepEqual(r, { error: null });
  assert.deepEqual(calls, ["insert:c", "remove:c1:a"]);
});

test("sin cambios no llama a la base", async () => {
  const { db, calls } = fakeDb();
  assert.deepEqual(await saveClientVendorsWith(db, "c1", ["a"], ["a"]), { error: null });
  assert.deepEqual(calls, []);
});

test("si el insert falla no borra y devuelve el error", async () => {
  const { db, calls } = fakeDb({ insertError: "boom" });
  assert.deepEqual(await saveClientVendorsWith(db, "c1", ["a"], ["b"]), { error: "boom" });
  assert.deepEqual(calls, ["insert:b"]);
});

test("si el delete falla devuelve el error (las altas ya quedaron)", async () => {
  const { db, calls } = fakeDb({ removeError: "nope" });
  assert.deepEqual(await saveClientVendorsWith(db, "c1", ["a"], ["b"]), { error: "nope" });
  assert.deepEqual(calls, ["insert:b", "remove:c1:a"]);
});
