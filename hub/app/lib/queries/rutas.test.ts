import { test } from "node:test";
import assert from "node:assert/strict";
import { armarSemana, lunesDe, sumarDias, type TiendaInfo } from "./rutas";
import type { DetalleRow } from "./merchandisers";

const tienda = (store_id: string): TiendaInfo => ({ store_id, name: `T-${store_id}`, client_name: "FARMATODO" });
const det = (fecha: string, store_id: string, resultado: DetalleRow["resultado"]): DetalleRow => ({
  fecha, store_id, store_name: "", client_name: null, resultado, skip_reason: null, anomaly_type: null, visit_id: null, check_in_time: null,
});

test("lunesDe lleva cualquier día a su lunes (domingo cierra la semana)", () => {
  assert.equal(lunesDe("2026-10-26"), "2026-10-26");
  assert.equal(lunesDe("2026-10-30"), "2026-10-26");
  assert.equal(lunesDe("2026-11-01"), "2026-10-26");
  assert.equal(lunesDe("2026-11-02"), "2026-11-02");
  assert.equal(sumarDias("2026-10-30", 3), "2026-11-02");
});

test("armarSemana da lunes a viernes en el orden de la ruta, con resultado solo en días cerrados", () => {
  const dias = armarSemana(
    "2026-10-26",
    [{ route_date: "2026-10-26", store_ids: ["b", "a"] }, { route_date: "2026-10-27", store_ids: ["c"] }],
    [tienda("a"), tienda("b"), tienda("c")],
    [det("2026-10-26", "b", "completada")],
    "2026-10-27",
  );
  assert.deepEqual(dias.map((d) => d.fecha), ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"]);
  assert.deepEqual(dias[0].paradas.map((p) => [p.orden, p.store_id, p.resultado]), [[1, "b", "completada"], [2, "a", "no_visitada"]]);
  assert.deepEqual(dias[1].paradas.map((p) => p.resultado), [null]);
  assert.deepEqual(dias[2].paradas, []);
});

test("armarSemana muestra el fin de semana solo si tiene ruta y cuenta lo que no se ve", () => {
  const dias = armarSemana(
    "2026-10-26",
    [{ route_date: "2026-10-31", store_ids: ["a", "x"] }],
    [tienda("a")], [], "2026-10-20",
  );
  assert.deepEqual(dias.map((d) => d.fecha).slice(-1), ["2026-10-31"]);
  assert.equal(dias.length, 6);
  assert.deepEqual(dias[5].paradas.map((p) => p.orden), [1]);
  assert.equal(dias[5].fueraDeAlcance, 1);
});
