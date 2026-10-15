import { test } from "node:test";
import assert from "node:assert/strict";
import { draftFromProposal, validateStoreDraft, reviewErrorMessage, notifyProposalsChanged, type Proposal } from "./storeProposals";

const p: Proposal = {
  proposal_id: "p1", name: "  Farmacia X  ", client_id: "c1", client_name: "Locatel", note: null,
  photo_urls: [], photo_signed: null, lat: 10.49, lng: -66.85, accuracy_m: 12,
  captured_at: "2026-10-14T15:00:00Z", created_at: "2026-10-14T15:01:00Z", status: "pendiente",
  author_name: "Elvis", reject_reason: null, store_id: null,
};

test("draftFromProposal: prellena nombre recortado, GPS y cadena", () => {
  const d = draftFromProposal(p);
  assert.equal(d.name, "Farmacia X");
  assert.equal(d.master_lat, 10.49);
  assert.equal(d.master_lng, -66.85);
  assert.equal(d.client_id, "c1");
  assert.equal(d.address, "");
});

test("validateStoreDraft: nombre y coordenadas obligatorios", () => {
  const d = draftFromProposal(p);
  assert.equal(validateStoreDraft(d), null);
  assert.equal(validateStoreDraft({ ...d, name: "  " }), "El nombre es obligatorio.");
  assert.equal(validateStoreDraft({ ...d, master_lat: 95 }), "Coordenadas fuera de rango.");
});

test("reviewErrorMessage: traduce errores del RPC", () => {
  assert.equal(reviewErrorMessage('propuesta_ya_revisada'), "Esta propuesta ya fue revisada");
  assert.equal(reviewErrorMessage('ERROR: solo_admin'), "Solo un administrador puede revisar propuestas.");
  assert.equal(reviewErrorMessage("otro"), "otro");
});

test("notifyProposalsChanged: no lanza sin window", () => {
  assert.doesNotThrow(() => notifyProposalsChanged());
});
