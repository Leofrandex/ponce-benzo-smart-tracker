import { test } from "node:test";
import assert from "node:assert/strict";
import { chainForStore, normalizeBranch, parseCoord, parseVisitDays } from "./chains";

test("chainForStore: cadenas por prefijo", () => {
  assert.equal(chainForStore("FTD CUARZO"), "Farmatodo");
  assert.equal(chainForStore("TDF RIO FARO"), "Farmatodo");
  assert.equal(chainForStore("LOCATEL LA YAGUARA"), "Locatel");
  assert.equal(chainForStore("GAMA EXPRESS"), "Gama");
  assert.equal(chainForStore("PLAZAS VISTA ALEGRE"), "Plaza's");
  assert.equal(chainForStore("DULCINEA"), null);
});
test("normalizeBranch: quita prefijo/acentos/espacios", () => {
  assert.equal(normalizeBranch("FTD CUARZO"), "CUARZO");
  assert.equal(normalizeBranch("TDF RIO FARO"), "RIO FARO");
  assert.equal(normalizeBranch("ÁVILA"), "AVILA");
});
test("parseCoord: separa y valida rango Venezuela", () => {
  assert.deepEqual(parseCoord("10.494, -66.832   "), { lat: 10.494, lng: -66.832 });
  assert.equal(parseCoord("0, 0"), null);
  assert.equal(parseCoord(null), null);
});
test("parseVisitDays: tokens ES -> numero de dia (LUN=1..VIE=5)", () => {
  assert.deepEqual(parseVisitDays("LUN"), [1]);
  assert.deepEqual(parseVisitDays("LUN-VIE"), [1, 5]);
  assert.deepEqual(parseVisitDays("MIE-VIE"), [3, 5]);
  assert.deepEqual(parseVisitDays(""), []);
});
