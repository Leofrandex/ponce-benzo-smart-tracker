"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";
import type { CumplimientoRow } from "@/app/lib/queries/dashboard";

interface Props { rows: CumplimientoRow[] }

const OK = "#16a34a";
const MEDIO = "#d97706";
const MAL = "#dc2626";

function color(pct: number) {
  if (pct >= 90) return OK;
  if (pct >= 70) return MEDIO;
  return MAL;
}

export default function CumplimientoChart({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="card" style={{ padding: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Cumplimiento por mercaderista</h2>
        <p className="text-muted text-sm">No hay rutas planificadas en este período.</p>
      </div>
    );
  }
  const data = rows.map((r) => ({
    nombre: r.full_name,
    pct: r.pct,
    detalle: `${r.hechas}/${r.planificadas}`,
  }));

  return (
    <div className="card" style={{ padding: 16 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Cumplimiento por mercaderista</h2>
      <ResponsiveContainer width="100%" height={Math.max(120, data.length * 42)}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
          <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="nombre" width={130} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(v, _n, p) => [`${v}% (${(p.payload as { detalle: string }).detalle})`, "Cumplimiento"]}
          />
          <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
            {data.map((d) => <Cell key={d.nombre} fill={color(d.pct)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
