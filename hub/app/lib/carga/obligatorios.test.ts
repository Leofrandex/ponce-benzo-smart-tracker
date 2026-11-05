import { test } from "node:test";
import assert from "node:assert/strict";
import { faltantesTienda, faltantesCliente } from "./obligatorios";

test("faltantesTienda: exige los seis obligatorios", () => {
  assert.deepEqual(faltantesTienda({ client_id: null, name: " ", business_channel: "", estado: "", municipio: "", address: "" }),
    ["Cliente", "Nombre", "Canal", "Estado", "Municipio", "Dirección"]);
});
test("faltantesTienda: los opcionales no se exigen", () => {
  assert.deepEqual(faltantesTienda({ client_id: "c", name: "A", business_channel: "farmacia", estado: "E", municipio: "M", address: "D" }), []);
});
test("faltantesCliente: nombre y canal", () => {
  assert.deepEqual(faltantesCliente({ name: "", business_channel: "" }), ["Nombre", "Canal"]);
});
