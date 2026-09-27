"use client";

import { useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";
import type { BarRectangleItem } from "recharts";
import type { CumplimientoRow } from "@/app/lib/queries/dashboard";
import { ChartLinkTick } from "./ChartLinkTick";
import { linkMercaderista } from "@/app/lib/queries/dashboardLinks";

interface Props { rows: CumplimientoRow[]; desde: string; hasta: string }

const OK = "#16a34a";
const MEDIO = "#d97706";
const MAL = "#dc2626";

// Umbrales compartidos con la tarjeta de Cumplimiento del panel.
export function colorCumplimiento(pct: number) {
  if (pct >= 90) return OK;
  if (pct >= 70) return MEDIO;
  return MAL;
}

export default function CumplimientoChart({ rows, desde, hasta }: Props) {
  const router = useRouter();
  if (rows.length === 0) {
    return (
      <div className="card" style={{ padding: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Cumplimiento por mercaderista</h2>
        <p className="text-muted text-sm">No hay rutas planificadas en este período.</p>
      </div>
    );
  }
  const data = rows.map((r) => ({
    userId: r.user_id,
    nombre: r.full_name,
    pct: r.pct,
    // Cuando un supervisor/admin cubrio la ruta de un ausente, el numerario
    // solo no lo cuenta: sin esta aclaracion el 100% se leeria como que el
    // titular estuvo en campo.
    detalle: r.cubiertas > 0
      ? `${r.hechas}/${r.planificadas} · ${r.cubiertas} por supervisión`
      : `${r.hechas}/${r.planificadas}`,
  }));

  return (
    <div className="card" style={{ padding: 16 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Cumplimiento por mercaderista</h2>
      <ResponsiveContainer width="100%" height={Math.max(120, data.length * 42)}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
          <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="nombre"
            width={130}
            tick={
              <ChartLinkTick
                hrefFor={(nombre) => {
                  const u = data.find((x) => x.nombre === nombre);
                  return u ? linkMercaderista(u.userId, desde, hasta) : null;
                }}
              />
            }
          />
          <Tooltip
            formatter={(v, _n, p) => [`${v}% (${(p.payload as { detalle: string }).detalle})`, "Cumplimiento"]}
          />
          <Bar
            dataKey="pct"
            radius={[0, 4, 4, 0]}
            style={{ cursor: "pointer" }}
            onClick={(d: BarRectangleItem) => router.push(linkMercaderista((d.payload as { userId: string }).userId, desde, hasta))}
          >
            {data.map((d) => <Cell key={d.userId} fill={colorCumplimiento(d.pct)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
