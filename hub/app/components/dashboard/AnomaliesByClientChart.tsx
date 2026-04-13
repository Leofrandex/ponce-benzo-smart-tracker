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
import { SupervisorReport } from "@/app/lib/mock-data";

interface Props {
  reports: SupervisorReport[];
}

const DANGER = "#dc2626";
const MUTED = "#8C9091";

export default function AnomaliesByClientChart({ reports }: Props) {
  // Group anomalies by client_name
  const counts: Record<string, number> = {};
  for (const r of reports) {
    if (r.status === "anomaly") {
      counts[r.client_name] = (counts[r.client_name] ?? 0) + 1;
    }
  }

  const data = Object.entries(counts)
    .map(([client, anomalias]) => ({ client, anomalias }))
    .sort((a, b) => b.anomalias - a.anomalias);

  const total = data.reduce((s, d) => s + d.anomalias, 0);

  return (
    <div className="chart-card">
      <div className="chart-title">Anomalías por cliente</div>
      <div className="chart-subtitle">{total} anomalía{total !== 1 ? "s" : ""} en el período</div>

      {data.length === 0 ? (
        <div style={{ textAlign: "center", color: MUTED, fontSize: "13px", padding: "24px 0" }}>
          Sin anomalías en este período
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
              formatter={(value) => [value, "Anomalías"]}
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
