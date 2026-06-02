"use client";

import { MessageSquare, CheckSquare, Clock } from "lucide-react";
import type { ContactEngagement } from "@/app/lib/types";

export function EngagementsPanel({ engagements }: { engagements: ContactEngagement[] }) {
  return (
    <div>
      <div className="section-title" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        Engagements y notas
        <span className="badge" style={{ background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)", fontSize: "9px" }}>Próximamente</span>
      </div>
      <div className="card" style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {engagements.length === 0 ? (
          <div style={{ fontSize: "13px", color: "var(--text-muted)", textAlign: "center", padding: "12px" }}>Sin registros.</div>
        ) : engagements.map((e) => (
          <div key={e.engagement_id} style={{ display: "flex", gap: "10px", paddingBottom: "10px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ flexShrink: 0, color: e.type === "todo" ? "var(--accent)" : "var(--text-muted)" }}>
              {e.type === "todo" ? <CheckSquare size={15} /> : <MessageSquare size={15} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "13px", color: "var(--text-primary)", lineHeight: 1.5 }}>{e.body}</div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "3px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "3px" }}><Clock size={10} />{new Date(e.created_at).toLocaleDateString("es-VE", { day: "numeric", month: "short" })}</span>
                {e.type === "todo" && e.status && <span className={`badge ${e.status === "done" ? "badge-success" : "badge-warning"}`}>{e.status === "done" ? "Hecho" : "Pendiente"}</span>}
              </div>
            </div>
          </div>
        ))}
        <input className="form-input" placeholder="Agregar nota o tarea… (próximamente)" disabled
          style={{ opacity: 0.5, cursor: "not-allowed" }} />
      </div>
    </div>
  );
}
