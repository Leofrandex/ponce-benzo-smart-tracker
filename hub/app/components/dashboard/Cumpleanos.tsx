"use client";

import { Cake } from "lucide-react";
import type { CumpleanosRow } from "@/app/lib/queries/dashboard";

interface Props { rows: CumpleanosRow[] }

const LIMITE = 8;

function cuando(dias: number) {
  if (dias === 0) return "hoy";
  if (dias === 1) return "mañana";
  return `en ${dias} días`;
}

export default function Cumpleanos({ rows }: Props) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <Cake size={15} style={{ color: "var(--accent)" }} />
        Cumpleaños de compradores
      </h2>
      {rows.length === 0 ? (
        <p className="text-muted text-sm">Ninguno en los próximos días.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {rows.slice(0, LIMITE).map((r) => (
            <li key={r.contact_id} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {r.nombre}
                <span className="text-muted" style={{ fontWeight: 400, fontSize: 11 }}>
                  {r.cargo ? ` · ${r.cargo}` : ""}
                </span>
              </div>
              <div className="text-muted" style={{ fontSize: 11 }}>
                {r.tienda} · {r.cliente} — <strong>{cuando(r.dias_para)}</strong>
              </div>
            </li>
          ))}
        </ul>
      )}
      {rows.length > LIMITE && (
        <p className="text-muted" style={{ fontSize: 11, marginTop: 8 }}>
          y {rows.length - LIMITE} más
        </p>
      )}
    </div>
  );
}
