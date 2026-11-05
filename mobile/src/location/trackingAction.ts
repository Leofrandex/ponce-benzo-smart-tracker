export const RESTART_COOLDOWN_MS = 300_000;

/** Que hacer con el servicio de ubicacion de fondo: arrancarlo, reiniciarlo (con espera entre reinicios) o nada. */
export function trackingAction(i: { running: boolean; stale: boolean; lastRestartMs: number | null; nowMs: number }): 'none' | 'start' | 'restart' {
  if (!i.running) return 'start';
  if (!i.stale) return 'none';
  if (i.lastRestartMs != null && i.nowMs - i.lastRestartMs < RESTART_COOLDOWN_MS) return 'none';
  return 'restart';
}
