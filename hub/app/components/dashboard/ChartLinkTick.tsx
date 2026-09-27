"use client";

import { useRouter } from "next/navigation";

// Etiqueta de eje de Recharts que navega. Recharts dibuja SVG, donde no cabe un
// <Link>: se usa role="link" + tabIndex + Enter para que funcione con teclado.
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
    <text
      x={x} y={y} dx={dx} dy={dy} textAnchor={anchor} fontSize={11} fill="var(--text-primary)"
      role="link" tabIndex={0} style={{ cursor: "pointer", textDecoration: "underline" }}
      onClick={() => router.push(href)}
      onKeyDown={(e) => { if (e.key === "Enter") router.push(href); }}
    >
      {label}
    </text>
  );
}
