import { test } from "node:test";
import assert from "node:assert/strict";
import { construirAsignaciones, normalizarNombre, type FilaExcel } from "./asignaciones";

const fila = (o: Partial<FilaExcel>): FilaExcel => ({
  nombreCorto: "GAMA", asesor: "MARIA RODRIGUEZ", gerente: "MILAGROS FERNÁNDEZ",
  mailAsesor: "aliadocomercialcaracas@ponce-benzo.com",
  mailGerente: "mfernandez@ponce-benzo.com", ...o,
});

test("normalizarNombre ignora acentos, mayúsculas y espacios dobles", () => {
  assert.equal(normalizarNombre("MILAGROS FERNÁNDEZ"), "MILAGROS FERNANDEZ");
  assert.equal(normalizarNombre("  Milagros   Fernandez "), "MILAGROS FERNANDEZ");
});

test("una fila genera asignación para el asesor Y para el gerente", () => {
  const r = construirAsignaciones([fila({})]);
  assert.equal(r.length, 2);
  const maria = r.find((p) => p.nombre === "MARIA RODRIGUEZ")!;
  const mila = r.find((p) => p.nombre === "MILAGROS FERNANDEZ")!;
  assert.deepEqual(maria.clientes, ["GAMA"]);
  assert.deepEqual(mila.clientes, ["GAMA"]);
});

test("la misma persona en varias filas acumula clientes sin duplicar", () => {
  const r = construirAsignaciones([
    fila({ nombreCorto: "GAMA" }),
    fila({ nombreCorto: "PLAZAS" }),
    fila({ nombreCorto: "GAMA" }), // repetida
  ]);
  const maria = r.find((p) => p.nombre === "MARIA RODRIGUEZ")!;
  assert.deepEqual(maria.clientes.sort(), ["GAMA", "PLAZA'S"]);
});

test("deduplica por NOMBRE aunque el correo del Excel sea inconsistente", () => {
  // Defecto real del Excel: en las filas de Locatel, el gerente es MILAGROS
  // pero el 'Mail del Gerente' dice Jfernandez@. No debe crear dos personas.
  const r = construirAsignaciones([
    fila({ nombreCorto: "GAMA", gerente: "MILAGROS FERNÁNDEZ", mailGerente: "mfernandez@ponce-benzo.com" }),
    fila({ nombreCorto: "65 LOCATEL", asesor: "CARLOS ZURITA", mailAsesor: "czurita@ponce-benzo.com",
           gerente: "MILAGROS FERNÁNDEZ", mailGerente: "Jfernandez@ponce-benzo.com" }),
  ]);
  const milas = r.filter((p) => p.nombre === "MILAGROS FERNANDEZ");
  assert.equal(milas.length, 1, "Milagros debe aparecer una sola vez");
  assert.deepEqual(milas[0].clientes.sort(), ["GAMA", "LOCATEL"]);
});

test("una persona con el correo vacío en una fila lo hereda de otra", () => {
  // Dubraska aparece como asesora con 'Mail del Asesor' vacío y como gerente con correo.
  const r = construirAsignaciones([
    fila({ nombreCorto: "TIO AMMI", asesor: "DUBRASKA PÉREZ", mailAsesor: "",
           gerente: "DUBRASKA PÉREZ", mailGerente: "dperez@ponce-benzo.com" }),
  ]);
  const dub = r.find((p) => p.nombre === "DUBRASKA PEREZ")!;
  assert.equal(dub.email, "dperez@ponce-benzo.com");
  assert.deepEqual(dub.clientes, ["TIO AMMI"]);
});

test("descarta filas cuyo cliente no existe en la base", () => {
  const r = construirAsignaciones([fila({ nombreCorto: "FARMATUYA" })]);
  assert.deepEqual(r, []);
});

test("el correo se normaliza a minúsculas", () => {
  const r = construirAsignaciones([
    fila({ nombreCorto: "65 LOCATEL", asesor: "JONATHAN FERNÁNDEZ", mailAsesor: "Jfernandez@Ponce-Benzo.com",
           gerente: "JONATHAN FERNÁNDEZ", mailGerente: "Jfernandez@Ponce-Benzo.com" }),
  ]);
  assert.equal(r[0].email, "jfernandez@ponce-benzo.com");
});
