"use client";

import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  Tooltip,
} from "recharts";
import type { BarRectangleItem } from "recharts";
import type { AnomaliaRow } from "@/app/lib/queries/dashboard";
import { anomalyLabel } from "@/app/lib/queries/visitDetail";
import { ChartLinkTick } from "./ChartLinkTick";
import { linkTareasAnomalias } from "@/app/lib/queries/dashboardLinks";
import SectionError from "@/app/components/ui/SectionError";
import { Skeleton, SkeletonList } from "@/app/components/ui/Skeleton";

interface Props {
  // null: todavía cargando (o falló). Nunca se confunde con "sin incidencias".
  rows: AnomaliaRow[] | null;
  error?: string | null;
  onRetry?: () => void;
  desde: string;
  hasta: string;
}

const DANGER = "#dc2626";
const MUTED = "#8C9091";

export default function AnomaliasPorTipo({ rows, error, onRetry, desde, hasta }: Props) {
  const router = useRouter();
  // anomalyLabel es el mismo mapa que usa la ficha de visita: los tipos se
  // muestran igual en todo el hub y no hay dos listas que puedan divergir.
  const data = (rows ?? []).map((r) => ({
    name: anomalyLabel(r.tipo),
    value: r.n,
    previo: r.n_periodo_anterior,
    codigo: r.tipo,
  }));
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="chart-card">
      <div className="chart-title">Anomalías por tipo</div>
      <div className="chart-subtitle">
        {rows && !error ? `${total} incidencia${total !== 1 ? "s" : ""} en el período` : !error ? <Skeleton h={9} w={140} pill /> : "—"}
      </div>

      {error ? (
        <SectionError what="las anomalías" detail={error} onRetry={onRetry} compact />
      ) : !rows ? (
        <SkeletonList rows={4} />
      ) : data.length === 0 ? (
        <div style={{ textAlign: "center", color: MUTED, fontSize: "var(--text-sm)", padding: "24px 0" }}>
          Sin incidencias en este período
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(120, data.length * 34)}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={140}
              interval={0}
              tick={
                <ChartLinkTick
                  hrefFor={(name) => {
                    const d = data.find((x) => x.name === name);
                    return d ? linkTareasAnomalias(d.codigo, desde, hasta) : null;
                  }}
                />
              }
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
            <Bar
              dataKey="value"
              radius={[0, 4, 4, 0]}
              style={{ cursor: "pointer" }}
              activeBar={{ opacity: 0.8 }}
              onClick={(d: BarRectangleItem) =>
                router.push(linkTareasAnomalias((d.payload as { codigo: string }).codigo, desde, hasta))
              }
            >
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
