// tools/ingesta/stageStoresMulti.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { assignExistingStores, ExistingStore } from "./stageStoresMulti";

test("assignExistingStores: singleton matchea por coord aunque el nombre haya cambiado", () => {
  const existing = new Map<string, ExistingStore[]>([
    ["c1|10.49054,-66.92497", [{ store_id: "s-arco", name: "FTD ARKO VIEJO" }]],
  ]);
  const out = assignExistingStores(
    [{ key: "c1|10.49054,-66.92497", finalName: "FTD ARCO" }], existing,
  );
  assert.equal(out.get(0), "s-arco");
});

test("assignExistingStores: par en misma coord → exacto primero, luego contención de nombre", () => {
  const existing = new Map<string, ExistingStore[]>([
    ["c1|10.50539,-66.90167", [
      { store_id: "s-avila", name: "FTD AVILA" },
      { store_id: "s-cande", name: "FTD LA CANDELARIA" },
    ]],
  ]);
  const out = assignExistingStores(
    [
      { key: "c1|10.50539,-66.90167", finalName: "FTD EL AVILA" },      // contención: AVILA ⊂ EL AVILA
      { key: "c1|10.50539,-66.90167", finalName: "FTD LA CANDELARIA" }, // exacto
    ],
    existing,
  );
  assert.equal(out.get(1), "s-cande");
  assert.equal(out.get(0), "s-avila");
});

test("assignExistingStores: par sin candidatos en DB → ninguno asignado (se crean)", () => {
  const out = assignExistingStores(
    [
      { key: "c1|10.48984,-66.85373", finalName: "FTD INDIGO" },
      { key: "c1|10.48984,-66.85373", finalName: "FTD RUBI" },
    ],
    new Map(),
  );
  assert.equal(out.size, 0);
});

test("assignExistingStores: un candidato no se asigna dos veces", () => {
  const existing = new Map<string, ExistingStore[]>([
    ["c1|10.1,-66.1", [{ store_id: "s-uno", name: "FTD UNO" }]],
  ]);
  const out = assignExistingStores(
    [
      { key: "c1|10.1,-66.1", finalName: "FTD UNO" },
      { key: "c1|10.1,-66.1", finalName: "FTD DOS" },
    ],
    existing,
  );
  assert.equal(out.get(0), "s-uno");
  assert.equal(out.has(1), false); // DOS se crea nueva
});
