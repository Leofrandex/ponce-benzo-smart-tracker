import type { Route } from '../types';

// Devuelve SÓLO la ruta de hoy; si no hay ruta asignada para hoy, null.
// (Sin fallback a fechas anteriores: mostrar una ruta de otro día confunde al
// mercaderista y arriesga registrar sesión/visitas contra la ruta equivocada.)
// Un reporte suelto crea una ruta especial con la misma fecha: la normal gana,
// porque es la que trae las tiendas planificadas.
export function pickRoute(routes: Route[], today: string): Route | null {
  const deHoy = routes.filter((r) => r.route_date === today);
  return deHoy.find((r) => !r.is_special) ?? deHoy[0] ?? null;
}
