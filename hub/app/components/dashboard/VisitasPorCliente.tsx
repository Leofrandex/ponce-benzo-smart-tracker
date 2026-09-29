"use client";

import { useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import type { BarRectangleItem } from "recharts";
import type { VisitasClienteRow } from "@/app/lib/queries/dashboard";
import { ChartLinkTick } from "./ChartLinkTick";
import { linkCadena } from "@/app/lib/queries/dashboardLinks";
import SectionError from "@/app/components/ui/SectionError";
import { Skeleton } from "@/app/components/ui/Skeleton";

// rows === null: todavía cargando (o falló). Nunca se confunde con "sin visitas".
interface Props { rows: VisitasClienteRow[] | null; error?: string | null; onRetry?: () => void }

// Mismo valor que --accent (SVG de Recharts no resuelve var() en `fill`).
const ACCENT = "#00205C";

export default function VisitasPorCliente({ rows, error, onRetry }: Props) {
  const router = useRouter();
  if (error || !rows || rows.length === 0) {
    return (
      <div className="card" style={{ padding: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Visitas por cadena</h2>
        {error ? <SectionError what="las visitas por cadena" detail={error} onRetry={onRetry} compact />
          : !rows ? <Skeleton h={180} style={{ marginTop: 8 }} />
          : <p className="text-muted text-sm">Sin visitas en este periodo.</p>}
      </div>
    );
  }
  const data = rows.map((r) => ({ name: r.cliente, visitas: r.visitas, anomalias: r.anomalias, clientId: r.client_id }));

  return (
    <div className="card" style={{ padding: 16 }}>
      <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Visitas por cadena</h2>
      <ResponsiveContainer width="100%" height={Math.max(120, data.length * 34)}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={130}
            tick={<ChartLinkTick hrefFor={(name) => linkCadena(data.find((x) => x.name === name)?.clientId ?? null)} />}
          />
          <Tooltip
            formatter={(v, n, p) =>
              [`${v}${n === "visitas" ? ` (${(p.payload as { anomalias: number }).anomalias} con anomalia)` : ""}`, "Visitas"]}
          />
          <Bar
            dataKey="visitas"
            fill={ACCENT}
            radius={[0, 4, 4, 0]}
            style={{ cursor: "pointer" }}
            activeBar={{ opacity: 0.8 }}
            onClick={(d: BarRectangleItem) => {
              const href = linkCadena((d.payload as { clientId: string | null }).clientId);
              if (href) router.push(href);
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
