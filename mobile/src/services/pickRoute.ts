import type { Route } from '../types';

// Devuelve SÓLO la ruta de hoy; si no hay ruta asignada para hoy, null.
// (Sin fallback a fechas anteriores: mostrar una ruta de otro día confunde al
// mercaderista y arriesga registrar sesión/visitas contra la ruta equivocada.)
export function pickRoute(routes: Route[], today: string): Route | null {
  return routes.find((r) => r.route_date === today) ?? null;
}
