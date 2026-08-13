"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  Tooltip,
} from "recharts";
import type { AnomaliaRow } from "@/app/lib/queries/dashboard";

interface Props {
  rows: AnomaliaRow[];
}

const DANGER = "#dc2626";
const MUTED = "#8C9091";

export default function AnomaliasPorTipo({ rows }: Props) {
  const data = rows.map((r) => ({ name: r.tipo, value: r.n, previo: r.n_periodo_anterior }));
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="chart-card">
      <div className="chart-title">Anomalías por tipo</div>
      <div className="chart-subtitle">{total} incidencia{total !== 1 ? "s" : ""} en el período</div>

      {data.length === 0 ? (
        <div style={{ textAlign: "center", color: MUTED, fontSize: "13px", padding: "24px 0" }}>
          Sin incidencias en este período
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: MUTED }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: MUTED }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(220,38,38,0.06)" }}
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.08)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
              formatter={(value, _, props) => [
                `${value} (período anterior: ${(props?.payload as { previo?: number })?.previo ?? 0})`,
                "Anomalías",
              ]}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={DANGER} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
