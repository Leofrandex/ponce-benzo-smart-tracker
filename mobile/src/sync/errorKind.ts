export type ErrorKind = "network" | "server";

const NETWORK = /network request failed|failed to fetch|timeout|timed out|aborted|network error|load failed/i;

export function classifyError(e: unknown): ErrorKind {
  if (e == null) return "server";
  if (typeof e === "object" && (e as { name?: unknown }).name === "AbortError") return "network";
  const msg = typeof e === "string" ? e : typeof (e as { message?: unknown }).message === "string" ? (e as { message: string }).message : "";
  return NETWORK.test(msg) ? "network" : "server";
}
