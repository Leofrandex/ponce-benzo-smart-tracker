"use client";

import Link from "next/link";
import { UserX } from "lucide-react";
import "./dashboard.css";
import type { ClienteSinVendedorRow } from "@/app/lib/queries/dashboard";
import { linkSinVendedor } from "@/app/lib/queries/dashboardLinks";
import SectionError from "@/app/components/ui/SectionError";

interface Props { rows: ClienteSinVendedorRow[] | null; error?: string | null; onRetry?: () => void }

// Alerta solo para admin. Un cliente sin vendedor desaparece del panel de todos
// los demas, y en silencio: por eso se muestra en vez de quedar como hueco mudo.
// Si la comprobacion falla, tambien se dice: callar seria afirmar "no hay".
export default function ClientesSinVendedor({ rows, error, onRetry }: Props) {
  if (error) {
    return (
      <div className="card" style={{ padding: "4px 16px" }}>
        <SectionError what="los clientes sin vendedor" detail={error} onRetry={onRetry} compact />
      </div>
    );
  }
  if (!rows || rows.length === 0) return null;
  return (
    <div className="card" style={{ padding: "12px 16px", borderLeft: "3px solid var(--danger)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
        <UserX size={15} style={{ color: "var(--danger)" }} />
        {rows.length} {rows.length === 1 ? "cliente sin vendedor asignado" : "clientes sin vendedor asignado"}
      </div>
      <p className="text-muted" style={{ fontSize: 12, margin: "6px 0 0" }}>
        {rows.map((r) => `${r.cliente} (${r.tiendas_activas})`).join(" · ")}
        {" — "}su información solo es visible para administradores.{" "}
        <Link href={linkSinVendedor()} className="dash-link" style={{ color: "var(--accent)", fontWeight: 600 }}>Asignar vendedores</Link>
      </p>
    </div>
  );
}
