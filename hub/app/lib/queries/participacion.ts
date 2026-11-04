// La RPC devuelve bigint: se convierte con Number() antes de sumar.
export function totalVisitas(rows: { visitas: number }[]): number {
  return rows.reduce((s, r) => s + Number(r.visitas), 0);
}

export function etiquetaParticipacion(visitas: number, total: number): string {
  const pct = total > 0 ? Math.round((visitas / total) * 100) : 0;
  return `${visitas} · ${pct}%`;
}
