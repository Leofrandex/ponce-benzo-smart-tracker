"use client";

import { User, Phone, Mail, Star } from "lucide-react";
import type { Contact } from "@/app/lib/types";

export function ContactList({ contacts }: { contacts: Contact[] }) {
  return (
    <div>
      <div className="section-title" style={{ marginBottom: "6px" }}>Contactos ({contacts.length})</div>
      {contacts.length === 0 ? (
        <div className="card" style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>Sin contactos registrados.</div>
      ) : (
        <div className="card" style={{ padding: "4px 14px", height: "175px", overflowY: "auto" }}>
          {contacts.map((c, idx) => (
            <div key={c.contact_id} style={{
              padding: "10px 0", opacity: c.active ? 1 : 0.6,
              borderTop: idx === 0 ? "none" : "1px solid var(--border)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--accent-glow)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <User size={16} color="var(--accent)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>{c.full_name}</span>
                    {c.is_primary && <Star size={12} color="var(--warning)" fill="var(--warning)" />}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{c.role_title ?? "—"}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "12px" }}>
                {c.phone && <a href={`tel:${c.phone}`} style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--accent)", textDecoration: "none" }}><Phone size={12} /> {c.phone}</a>}
                {c.email && <a href={`mailto:${c.email}`} style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--accent)", textDecoration: "none" }}><Mail size={12} /> {c.email}</a>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
