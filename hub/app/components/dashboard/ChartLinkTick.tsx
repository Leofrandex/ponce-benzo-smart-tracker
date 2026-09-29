"use client";

import { useRouter } from "next/navigation";
import "./dashboard.css";

// Etiqueta de eje de Recharts que navega. Recharts dibuja SVG, donde un <a>
// nativo sí es focalizable y responde a Enter sin JS propio: por eso el
// enlace real es <a>, no el <text>.
export function ChartLinkTick({
  x, y, payload, hrefFor, anchor = "end",
}: { x?: number; y?: number; payload?: { value: string }; hrefFor: (label: string) => string | null; anchor?: "end" | "middle" }) {
  const router = useRouter();
  const label = payload?.value ?? "";
  const href = hrefFor(label);
  const dx = anchor === "end" ? -4 : 0;
  const dy = anchor === "end" ? 4 : 14;
  if (!href) {
    return <text x={x} y={y} dx={dx} dy={dy} textAnchor={anchor} fontSize={11} fill="var(--text-muted)">{label}</text>;
  }
  return (
    <a
      href={href}
      className="dash-link"
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        router.push(href);
      }}
    >
      <text
        x={x} y={y} dx={dx} dy={dy} textAnchor={anchor} fontSize={11} fontWeight={500} fill="var(--text-secondary)"
      >
        {label}
      </text>
    </a>
  );
}
