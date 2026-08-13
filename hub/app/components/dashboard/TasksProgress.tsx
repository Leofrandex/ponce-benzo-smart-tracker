"use client";

import type { BacklogRow, TiempoResolucion } from "@/app/lib/queries/dashboard";

interface Props {
  rows: BacklogRow[];
  // Opcional: si no llega (o horas_promedio es null porque aun no hay tareas
  // resueltas), la tarjeta simplemente omite la linea en vez de mostrar "null".
  resolucion?: TiempoResolucion | null;
}

// Los 4 tramos vienen siempre de la base, incluso con ceros, para que la tarjeta
// no cambie de forma segun los datos.
const ETIQUETA: Record<string, string> = {
  "0-7": "Menos de 1 semana",
  "8-15": "1 a 2 semanas",
  "16-30": "2 a 4 semanas",
  "+30": "Mas de un mes",
};

export default function TasksProgress({ rows, resolucion }: Props) {
  const total = rows.reduce((s, r) => s + r.n, 0);

  return (
    <div className="card" style={{ padding: 16 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
        Antiguedad de las tareas abiertas
      </h2>
      {total === 0 ? (
        <p className="text-muted text-sm">No hay tareas abiertas.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {rows.map((r) => {
            const viejo = r.tramo === "+30";
            return (
              <li key={r.tramo} style={{ display: "flex", justifyContent: "space-between",
                                         padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 13 }}>{ETIQUETA[r.tramo] ?? r.tramo}</span>
                <strong style={{ fontSize: 13, color: viejo && r.n > 0 ? "var(--danger)" : undefined }}>
                  {r.n}
                </strong>
              </li>
            );
          })}
        </ul>
      )}

      {/* horas_promedio llega null mientras no haya tareas resueltas en el periodo:
          nunca se asume numero, se omite la linea en vez de mostrar "null horas". */}
      {resolucion && resolucion.resueltas > 0 && typeof resolucion.horas_promedio === "number" && (
        <p className="text-muted" style={{ fontSize: 11, marginTop: 10 }}>
          Tiempo medio de resolución: {resolucion.horas_promedio.toFixed(1)} h ({resolucion.resueltas} resueltas)
        </p>
      )}
    </div>
  );
}
