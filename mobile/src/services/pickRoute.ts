import type { Route } from '../types';

// Elige la ruta a mostrar: la de hoy; si no hay, la de fecha más reciente.
// Devuelve { route, isFallback } o null si no hay rutas.
export function pickRoute(
  routes: Route[],
  today: string,
): { route: Route; isFallback: boolean } | null {
  if (routes.length === 0) return null;
  const todayRoute = routes.find((r) => r.route_date === today);
  if (todayRoute) return { route: todayRoute, isFallback: false };
  const sorted = [...routes].sort((a, b) => b.route_date.localeCompare(a.route_date));
  return { route: sorted[0], isFallback: true };
}
