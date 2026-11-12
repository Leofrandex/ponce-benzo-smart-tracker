/** Próximo intento de fotos: espera 2^attempts minutos, con tope de una hora. */
export function nextPhotoRetry(attempts: number, nowMs: number): string {
  return new Date(nowMs + Math.min(2 ** attempts, 60) * 60_000).toISOString();
}
