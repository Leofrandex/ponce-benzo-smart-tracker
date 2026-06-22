// ¿Toca emitir un ping? true si nunca se emitió o si pasó el intervalo mínimo (30s).
export function shouldEmitPing(lastTsMs: number | null, nowMs: number, minGapMs = 30_000): boolean {
  return lastTsMs == null || nowMs - lastTsMs >= minGapMs;
}
