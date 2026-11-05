export const NET_TIMEOUT_MS = 15_000;
export const PHOTO_TIMEOUT_MS = 60_000;

type Input = string | URL | Request;

function pathOf(input: Input): string {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  try {
    return new URL(raw).pathname;
  } catch {
    return raw.split("?")[0];
  }
}

export function timeoutFor(input: Input): number {
  return pathOf(input).includes("/storage/v1/object/") ? PHOTO_TIMEOUT_MS : NET_TIMEOUT_MS;
}

/** fetch que aborta de verdad la petición al vencer el plazo y respeta el signal externo. */
export function createTimedFetch(baseFetch: typeof fetch = fetch): typeof fetch {
  return (async (input: Input, init?: RequestInit) => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutFor(input));
    const external = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    if (external) {
      if (external.aborted) ac.abort();
      else external.addEventListener("abort", () => ac.abort(), { once: true });
    }
    try {
      return await baseFetch(input as RequestInfo, { ...init, signal: ac.signal });
    } finally {
      clearTimeout(timer);
    }
  }) as typeof fetch;
}
