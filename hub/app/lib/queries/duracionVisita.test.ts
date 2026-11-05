import { test } from "node:test";
import assert from "node:assert/strict";
import { etiquetaDuracion } from "./duracionVisita";

const t = "2026-11-10T14:32:00Z";
test("minutos redondeados", () => assert.equal(etiquetaDuracion("2026-11-10T14:20:00Z", t), "12 min"));
test("menos de un minuto", () => assert.equal(etiquetaDuracion("2026-11-10T14:31:40Z", t), "<1 min"));
test("más de una hora", () => assert.equal(etiquetaDuracion("2026-11-10T13:27:00Z", t), "1 h 5 min"));
test("sin inicio", () => assert.equal(etiquetaDuracion(null, t), "—"));
test("inicio posterior al guardado", () => assert.equal(etiquetaDuracion("2026-11-10T15:00:00Z", t), "—"));
