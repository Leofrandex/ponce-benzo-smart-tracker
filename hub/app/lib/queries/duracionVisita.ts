// Duración de una visita: desde que se abrió (started_at) hasta que se guardó
// (check_in_time), ambos de la misma fila.
export function etiquetaDuracion(startedAt: string | null, checkIn: string | null): string {
  if (!startedAt || !checkIn) return "—";
  const ms = new Date(checkIn).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const min = Math.round(ms / 60000);
  if (min < 1) return "<1 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
