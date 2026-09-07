// Regla de "actividad" del mapa en vivo.
//
// Antes, el hub marcaba activo a cualquier mercaderista con una sesión sin
// `session_end`, y pintaba su último ping aunque tuviera días. Bastaba una
// jornada olvidada sin cerrar (pasó el viernes 2026-09-04) para que el mapa
// mostrara a todo el equipo "activo" un sábado en la noche.
//
// Ahora, activo = sesión abierta Y último ping dentro de LIVE_WINDOW_MIN.
// La app móvil manda pings cada pocos minutos en background; 20 min cubre
// túneles, semáforos largos y reintentos de red sin dar falsos negativos.

export const LIVE_WINDOW_MIN = 20;

export function isRecentPing(lastSeenIso: string, nowIso: string = new Date().toISOString()): boolean {
  const seen = Date.parse(lastSeenIso);
  const now = Date.parse(nowIso);
  if (Number.isNaN(seen) || Number.isNaN(now)) return false;
  return now - seen <= LIVE_WINDOW_MIN * 60_000;
}

// "hace 15 min", "hace 3 h", "hace 2 días" — para el popup del marcador.
export function formatAgo(lastSeenIso: string, nowIso: string = new Date().toISOString()): string {
  const diffMs = Date.parse(nowIso) - Date.parse(lastSeenIso);
  if (Number.isNaN(diffMs)) return "sin señal";
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "hace menos de 1 min";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "hace 1 día" : `hace ${d} días`;
}
