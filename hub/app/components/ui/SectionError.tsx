"use client";

import { AlertCircle } from "lucide-react";

// Estado de error de una sección: distinto de "vacío", con salida (Reintentar).
// El detalle técnico queda plegado para soporte.
export default function SectionError({
  what, detail, onRetry, compact,
}: {
  what: string;            // "las tareas", "el cumplimiento"…
  detail?: string | null;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      className={compact ? undefined : "empty-state"}
      style={compact ? { display: "flex", flexDirection: "column", gap: "8px", padding: "12px 0" } : undefined}
    >
      <p style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "var(--text-base)", color: "var(--text-primary)", fontWeight: 600 }}>
        <AlertCircle size={16} color="var(--danger)" aria-hidden /> No pudimos cargar {what}
      </p>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>Revisá la conexión e intentá de nuevo.</p>
      {onRetry && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry} style={{ alignSelf: compact ? "flex-start" : "center" }}>
          Reintentar
        </button>
      )}
      {detail && (
        <details style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
          <summary style={{ cursor: "pointer" }}>Detalle</summary>
          {detail}
        </details>
      )}
    </div>
  );
}
