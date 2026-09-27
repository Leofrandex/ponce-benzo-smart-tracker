import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchAllPages } from "./paginate";

function fakeSource(total: number) {
  const calls: [number, number][] = [];
  const rows = Array.from({ length: total }, (_, i) => i);
  const fetchPage = async (from: number, to: number) => {
    calls.push([from, to]);
    return rows.slice(from, to + 1);
  };
  return { fetchPage, calls };
}

test("fetchAllPages junta varias páginas en orden", async () => {
  const { fetchPage, calls } = fakeSource(2500);
  const out = await fetchAllPages(fetchPage, 1000);
  assert.equal(out.length, 2500);
  assert.equal(out[0], 0);
  assert.equal(out[2499], 2499);
  assert.deepEqual(calls, [[0, 999], [1000, 1999], [2000, 2999]]);
});

test("fetchAllPages con exactamente pageSize filas pide una página más y termina", async () => {
  const { fetchPage, calls } = fakeSource(1000);
  const out = await fetchAllPages(fetchPage, 1000);
  assert.equal(out.length, 1000);
  assert.equal(new Set(out).size, 1000);
  assert.deepEqual(calls, [[0, 999], [1000, 1999]]);
});

test("fetchAllPages con cero filas devuelve vacío tras una sola llamada", async () => {
  const { fetchPage, calls } = fakeSource(0);
  assert.deepEqual(await fetchAllPages(fetchPage, 1000), []);
  assert.equal(calls.length, 1);
});
