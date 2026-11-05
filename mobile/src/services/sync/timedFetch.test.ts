import test from "node:test";
import assert from "node:assert/strict";
import { createTimedFetch, timeoutFor } from "./timedFetch";

test("timeoutFor: fotos 60 s, resto 15 s", () => {
  assert.equal(timeoutFor("https://x.supabase.co/storage/v1/object/visit-photos/a.jpg"), 60_000);
  assert.equal(timeoutFor("https://x.supabase.co/rest/v1/visits"), 15_000);
});
test("timeoutFor: solo cuenta el pathname, no la query", () => {
  assert.equal(timeoutFor("https://x/rest/v1/visits?q=/storage/v1/object/"), 15_000);
});
test("timeoutFor: acepta URL y Request", () => {
  assert.equal(timeoutFor(new URL("https://x/storage/v1/object/a")), 60_000);
  assert.equal(timeoutFor(new Request("https://x/storage/v1/object/a")), 60_000);
});
test("createTimedFetch aborta la petición al vencer el plazo", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let signal: AbortSignal | undefined;
  const base = ((_: unknown, init: RequestInit) => { signal = init.signal!; return new Promise(() => {}); }) as typeof fetch;
  void createTimedFetch(base)("https://x/rest/v1/visits").catch(() => {});
  t.mock.timers.tick(15_000);
  assert.equal(signal!.aborted, true);
});
test("createTimedFetch respeta un signal externo", async () => {
  const ac = new AbortController();
  let signal: AbortSignal | undefined;
  const base = ((_: unknown, init: RequestInit) => { signal = init.signal!; return Promise.resolve(new Response()); }) as typeof fetch;
  await createTimedFetch(base)("https://x/rest/v1/visits", { signal: ac.signal });
  ac.abort();
  assert.equal(signal!.aborted, true);
});
test("createTimedFetch limpia el timer al resolver: pasado el plazo no aborta", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let signal: AbortSignal | undefined;
  const base = ((_: unknown, init: RequestInit) => { signal = init.signal!; return Promise.resolve(new Response()); }) as typeof fetch;
  await createTimedFetch(base)("https://x/rest/v1/visits");
  t.mock.timers.tick(15_000);
  assert.equal(signal!.aborted, false);
});
test("createTimedFetch limpia el timer también al fallar", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let signal: AbortSignal | undefined;
  const base = ((_: unknown, init: RequestInit) => { signal = init.signal!; return Promise.reject(new Error("boom")); }) as typeof fetch;
  await createTimedFetch(base)("https://x/rest/v1/visits").catch(() => {});
  t.mock.timers.tick(15_000);
  assert.equal(signal!.aborted, false);
});
