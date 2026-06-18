// ¿Toca emitir un ping? true si nunca se emitió o si pasó el intervalo mínimo.
export function shouldEmitPing(lastAtMs: number | null, nowMs: number, minIntervalMs = 30_000): boolean {
  return lastAtMs == null || nowMs - lastAtMs >= minIntervalMs;
}
