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
import type { DashboardVisitRow } from "@/app/lib/queries/derive";

interface Props {
  visits: DashboardVisitRow[];
}

const DANGER = "#dc2626";
const MUTED = "#8C9091";

export default function AnomaliesByClientChart({ visits }: Props) {
  const counts: Record<string, number> = {};
  for (const v of visits) {
    if (v.status === "anomaly") {
      const key = v.client_name ?? "Sin cadena";
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const data = Object.entries(counts)
    .map(([client, anomalias]) => ({
      client,
      anomalias,
      pct: total > 0 ? Math.round((anomalias / total) * 100) : 0,
    }))
    .sort((a, b) => b.anomalias - a.anomalias);

  return (
    <div className="chart-card">
      <div className="chart-title">Incidencias por cadena</div>
      <div className="chart-subtitle">{total} incidencia{total !== 1 ? "s" : ""} en el período</div>

      {data.length === 0 ? (
        <div style={{ textAlign: "center", color: MUTED, fontSize: "13px", padding: "24px 0" }}>
          Sin incidencias en este período
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <XAxis
              dataKey="client"
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
                `${value} (${(props?.payload as { pct?: number })?.pct ?? 0}%)`,
                "Incidencias",
              ]}
            />
            <Bar dataKey="anomalias" radius={[4, 4, 0, 0]}>
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
