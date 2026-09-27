import { test } from "node:test";
import assert from "node:assert/strict";
import { canConfigure, roleLabel } from "./roles";

test("solo admin puede configurar", () => {
  assert.equal(canConfigure("admin"), true);
  for (const r of ["vendedor", "merchandiser", "colaborador", "", null, undefined, "ADMIN"]) {
    assert.equal(canConfigure(r as string | null | undefined), false, String(r));
  }
});

test("roleLabel conoce colaborador", () => {
  assert.equal(roleLabel("colaborador"), "Colaborador");
  assert.equal(roleLabel("admin"), "Administrador");
  assert.equal(roleLabel("otro"), "otro");
});
