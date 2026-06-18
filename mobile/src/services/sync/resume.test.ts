import { test } from "node:test";
import assert from "node:assert/strict";
import { pickResumableSession } from "./resume";
import type { SessionRow } from "../db";

const row = (over: Partial<SessionRow>): SessionRow => ({
  session_id: "s", user_id: "u1", route_id: "r1",
  session_start: "2026-06-18T10:00:00.000Z", session_end: null,
  start_lat: null, start_lng: null, synced: 0, ...over,
});

test("pickResumableSession: devuelve la sesión abierta del usuario", () => {
  const open = row({ session_id: "open", session_end: null });
  assert.equal(pickResumableSession([open], "u1")?.session_id, "open");
});

test("pickResumableSession: null si la sesión está cerrada", () => {
  const closed = row({ session_id: "closed", session_end: "2026-06-18T12:00:00.000Z" });
  assert.equal(pickResumableSession([closed], "u1"), null);
});

test("pickResumableSession: null si no hay sesiones", () => {
  assert.equal(pickResumableSession([], "u1"), null);
});

test("pickResumableSession: ignora sesiones abiertas de otro usuario", () => {
  const other = row({ session_id: "otro", user_id: "u2", session_end: null });
  assert.equal(pickResumableSession([other], "u1"), null);
});

test("pickResumableSession: entre varias abiertas, la más reciente por session_start", () => {
  const vieja = row({ session_id: "vieja", session_start: "2026-06-18T08:00:00.000Z" });
  const nueva = row({ session_id: "nueva", session_start: "2026-06-18T11:00:00.000Z" });
  assert.equal(pickResumableSession([vieja, nueva], "u1")?.session_id, "nueva");
});
