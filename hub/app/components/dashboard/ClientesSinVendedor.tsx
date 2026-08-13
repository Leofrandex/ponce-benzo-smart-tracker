"use client";

import { UserX } from "lucide-react";
import type { ClienteSinVendedorRow } from "@/app/lib/queries/dashboard";

interface Props { rows: ClienteSinVendedorRow[] }

// Alerta solo para admin. Un cliente sin vendedor desaparece del panel de todos
// los demas, y en silencio: por eso se muestra en vez de quedar como hueco mudo.
export default function ClientesSinVendedor({ rows }: Props) {
  if (rows.length === 0) return null;
  return (
    <div className="card" style={{ padding: "12px 16px", borderLeft: "3px solid var(--danger)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700 }}>
        <UserX size={15} style={{ color: "var(--danger)" }} />
        {rows.length} {rows.length === 1 ? "cliente sin vendedor asignado" : "clientes sin vendedor asignado"}
      </div>
      <p className="text-muted" style={{ fontSize: 12, margin: "6px 0 0" }}>
        {rows.map((r) => `${r.cliente} (${r.tiendas_activas})`).join(" · ")}
        {" — "}su información solo es visible para administradores.
      </p>
    </div>
  );
}
