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

const ACCENT = "#00205C";
const MUTED = "#8C9091";

export default function StoresPerMerchandiserChart({ visits }: Props) {
  const storesByMerc: Record<string, Set<string>> = {};
  for (const v of visits) {
    const name = v.merchandiser_name ?? "—";
    if (!storesByMerc[name]) storesByMerc[name] = new Set();
    storesByMerc[name].add(v.store_id);
  }

  const data = Object.entries(storesByMerc)
    .map(([nombre, stores]) => ({
      nombre: nombre.split(" ")[0], // first name only for axis legibility
      nombreCompleto: nombre,
      sucursales: stores.size,
    }))
    .sort((a, b) => b.sucursales - a.sucursales);

  const total = data.reduce((s, d) => s + d.sucursales, 0);

  return (
    <div className="chart-card">
      <div className="chart-title">Sucursales visitadas por mercaderista</div>
      <div className="chart-subtitle">{total} tienda{total !== 1 ? "s" : ""} visitadas en el período</div>

      {data.length === 0 ? (
        <div style={{ textAlign: "center", color: MUTED, fontSize: "13px", padding: "24px 0" }}>
          Sin visitas en este período
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <XAxis
              dataKey="nombre"
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
              cursor={{ fill: "rgba(0,32,92,0.06)" }}
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.08)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
              formatter={(value, _, props) => [
                value,
                (props?.payload as { nombreCompleto?: string })?.nombreCompleto ?? "Sucursales",
              ]}
            />
            <Bar dataKey="sucursales" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={ACCENT} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
