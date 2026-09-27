import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePeriodo, serializePeriodo } from "./period";

const DEF: [string, string] = ["2026-09-21", "2026-09-27"];

test("parsePeriodo usa la URL si es válida y el default si no", () => {
  assert.deepEqual(parsePeriodo(new URLSearchParams("desde=2026-09-01&hasta=2026-09-15"), DEF), { desde: "2026-09-01", hasta: "2026-09-15" });
  assert.deepEqual(parsePeriodo(new URLSearchParams(""), DEF), { desde: "2026-09-21", hasta: "2026-09-27" });
  assert.deepEqual(parsePeriodo(new URLSearchParams("desde=2026-13-40&hasta=ayer"), DEF), { desde: "2026-09-21", hasta: "2026-09-27" });
});

test("parsePeriodo con desde posterior a hasta usa el default", () => {
  assert.deepEqual(parsePeriodo(new URLSearchParams("desde=2026-09-20&hasta=2026-09-10"), DEF), { desde: "2026-09-21", hasta: "2026-09-27" });
});

test("serializePeriodo arma la query", () => {
  assert.equal(serializePeriodo("2026-09-01", "2026-09-15"), "desde=2026-09-01&hasta=2026-09-15");
});
