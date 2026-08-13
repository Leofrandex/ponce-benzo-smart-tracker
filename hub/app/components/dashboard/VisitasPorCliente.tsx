"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import type { VisitasClienteRow } from "@/app/lib/queries/dashboard";

interface Props { rows: VisitasClienteRow[] }

const ACCENT = "#2563eb";

export default function VisitasPorCliente({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="card" style={{ padding: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Visitas por cadena</h2>
        <p className="text-muted text-sm">Sin visitas en este periodo.</p>
      </div>
    );
  }
  const data = rows.map((r) => ({ name: r.cliente, visitas: r.visitas, anomalias: r.anomalias }));

  return (
    <div className="card" style={{ padding: 16 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Visitas por cadena</h2>
      <ResponsiveContainer width="100%" height={Math.max(120, data.length * 34)}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(v, n, p) =>
              [`${v}${n === "visitas" ? ` (${(p.payload as { anomalias: number }).anomalias} con anomalia)` : ""}`, "Visitas"]}
          />
          <Bar dataKey="visitas" fill={ACCENT} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
