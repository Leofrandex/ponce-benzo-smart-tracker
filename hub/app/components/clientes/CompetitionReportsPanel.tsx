"use client";

import { useState } from "react";
import { Camera, User, Tag, ChevronRight, Megaphone } from "lucide-react";
import type { StoreCompetitionReport } from "@/app/lib/queries/reports";
import { PhotoLightbox } from "./PhotoLightbox";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const dateStr =
    d.toDateString() === now.toDateString()
      ? "Hoy"
      : d.toDateString() === new Date(now.getTime() - 86400000).toDateString()
        ? "Ayer"
        : d.toLocaleDateString("es-VE", { day: "numeric", month: "short" });
  return `${dateStr} · ${d.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}`;
}

export function CompetitionReportsPanel({ reports }: { reports: StoreCompetitionReport[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);

  if (reports.length === 0) {
    return (
      <div
        className="card"
        style={{ padding: "28px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}
      >
        <Megaphone size={20} style={{ opacity: 0.4 }} />
        Sin reportes de competencia para esta tienda.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {reports.map((r) => {
        const isExpanded = expanded === r.report_id;
        return (
          <div
            key={r.report_id}
            className="card"
            style={{ padding: "14px 16px", cursor: "pointer" }}
            onClick={() => setExpanded(isExpanded ? null : r.report_id)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <div style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", background: "var(--accent-glow)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Tag size={15} color="var(--accent)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{r.brand_name}</div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px", display: "flex", alignItems: "center", gap: "3px" }}>
                  <User size={10} /> {r.merchandiser_name} · {formatDateTime(r.created_at)}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                <span className="badge">{r.activation_label}</span>
                <ChevronRight size={13} color="var(--text-muted)" style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 150ms ease" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", fontSize: "11px", color: "var(--text-muted)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "3px" }}><Camera size={11} />{r.photo_urls.length} fotos</span>
            </div>
            {isExpanded && (
              <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
                {r.notes && (
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "10px" }}>{r.notes}</p>
                )}
                {r.photo_urls.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: "6px" }}>
                    {r.photo_urls.map((url, idx) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={url}
                        src={url}
                        alt={`Foto ${idx + 1}`}
                        onClick={() => setLightbox({ urls: r.photo_urls, index: idx })}
                        style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: "var(--radius-sm)", cursor: "pointer" }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {lightbox && <PhotoLightbox urls={lightbox.urls} startIndex={lightbox.index} onClose={() => setLightbox(null)} />}
    </div>
  );
}
