// Unico lugar donde vive la definicion de cada KPI. La descripcion viaja junto a
// la etiqueta a proposito: si viviera suelta en el componente, un cambio en el
// calculo la dejaria desincronizada y el tooltip pasaria a mentir.

export type KpiId = "cumplimiento" | "visitas" | "anomalias" | "tareas";

export interface KpiDef {
  etiqueta: string;
  descripcion: string;
}

export const KPI_DEFS: Record<KpiId, KpiDef> = {
  cumplimiento: {
    etiqueta: "Cumplimiento de ruta",
    descripcion:
      "De las visitas que la ruta planificaba para los días ya transcurridos del período, cuántas se realizaron. " +
      "No cuenta días futuros ni tiendas fuera de ruta. Las visitas omitidas cuentan como no realizadas.",
  },
  visitas: {
    etiqueta: "Visitas",
    descripcion:
      "Check-ins registrados en el período, incluidas las que reportaron una anomalía. " +
      "No incluye las visitas omitidas ni las tiendas de cadenas que no tienes asignadas.",
  },
  anomalias: {
    etiqueta: "Tasa de anomalías",
    descripcion:
      "Porcentaje de visitas del período que reportaron al menos una anomalía. " +
      "Una visita con dos anomalías cuenta una sola vez aquí; el desglose por tipo sí las separa.",
  },
  tareas: {
    etiqueta: "Tareas abiertas",
    descripcion:
      "Tareas sin resolver de tus cadenas, sin importar cuándo se crearon. " +
      "El número entre paréntesis son las que llevan más de 15 días abiertas.",
  },
};

export function kpiDef(id: KpiId): KpiDef {
  return KPI_DEFS[id];
}
