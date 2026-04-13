"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Search, ChevronRight, AlertTriangle, Mail, Phone } from "lucide-react";
import { mockStores, mockTasks } from "@/app/lib/mock-data";

export default function ContactosPage() {
  const [search, setSearch] = useState("");

  const contacts = useMemo(() => {
    return mockStores.map((s) => {
      const pendingTasksCount = mockTasks.filter(
        (t) => t.store_id === s.store_id && t.status !== "resolved"
      ).length;
      return {
        store_id:        s.store_id,
        name:            s.name,
        contact_email:   s.contact_email,
        contact_phone:   s.contact_phone,
        pending_tasks:   pendingTasksCount,
        active:          s.active,
      };
    });
  }, []);

  const filtered = contacts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.contact_email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px" }}>
          Contactos
        </h1>
        <p className="text-muted text-sm" style={{ marginTop: "4px" }}>
          {contacts.length} tiendas asignadas
        </p>
      </div>

      {/* Search */}
      <div style={{ position: "relative" }}>
        <Search
          size={15}
          color="var(--text-muted)"
          style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }}
        />
        <input
          className="form-input"
          placeholder="Buscar por nombre o correo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: "34px" }}
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <Building2 size={44} style={{ opacity: 0.2 }} />
          <div className="empty-title">Sin tiendas</div>
          <div className="empty-desc">
            {search ? "Ninguna tienda coincide con la búsqueda." : "No hay tiendas registradas."}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {/* Desktop header */}
          <div className="contactos-table-header">
            <div>Nombre</div>
            <div>Correo</div>
            <div>Teléfono</div>
            <div>Actividades</div>
          </div>

          {/* Rows */}
          {filtered.map((contact, idx) => (
            <Link
              key={contact.store_id}
              href={`/supervisor/contactos/${contact.store_id}`}
              style={{ textDecoration: "none" }}
            >
              <div
                className="contactos-table-row"
                style={{
                  borderTop: idx === 0 ? "none" : "1px solid var(--border)",
                  opacity: contact.active ? 1 : 0.6,
                }}
              >
                {/* Nombre */}
                <div className="contactos-cell-name">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                    <div
                      style={{
                        width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                        background: contact.active ? "var(--success)" : "var(--text-muted)",
                      }}
                    />
                    <span style={{
                      fontSize: "14px", fontWeight: 700, color: "var(--text-primary)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {contact.name}
                    </span>
                  </div>
                  {/* Mobile: sub-details */}
                  <div className="contactos-mobile-sub">
                    {contact.contact_email && (
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <Mail size={10} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {contact.contact_email}
                        </span>
                      </span>
                    )}
                    {contact.contact_phone && (
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <Phone size={10} />
                        {contact.contact_phone}
                      </span>
                    )}
                    <span style={{ color: contact.pending_tasks > 0 ? "var(--warning)" : "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                      {contact.pending_tasks > 0 && <AlertTriangle size={10} />}
                      {contact.pending_tasks > 0
                        ? `${contact.pending_tasks} ${contact.pending_tasks === 1 ? "actividad pendiente" : "actividades pendientes"}`
                        : "Sin actividades pendientes"}
                    </span>
                  </div>
                </div>

                {/* Correo (desktop only) */}
                <div className="contactos-cell-desktop" style={{ minWidth: 0 }}>
                  {contact.contact_email ? (
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                      {contact.contact_email}
                    </span>
                  ) : (
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>—</span>
                  )}
                </div>

                {/* Teléfono (desktop only) */}
                <div className="contactos-cell-desktop">
                  {contact.contact_phone ? (
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      {contact.contact_phone}
                    </span>
                  ) : (
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>—</span>
                  )}
                </div>

                {/* Actividades (desktop only) */}
                <div className="contactos-cell-desktop" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {contact.pending_tasks > 0 && <AlertTriangle size={12} color="var(--warning)" />}
                  <span style={{ fontSize: "12px", color: contact.pending_tasks > 0 ? "var(--warning)" : "var(--text-muted)" }}>
                    {contact.pending_tasks > 0
                      ? `${contact.pending_tasks} ${contact.pending_tasks === 1 ? "actividad pendiente" : "actividades pendientes"}`
                      : "Sin actividades pendientes"}
                  </span>
                </div>

                {/* Chevron */}
                <div style={{ display: "flex", alignItems: "center", paddingLeft: "8px" }}>
                  <ChevronRight size={15} color="var(--text-muted)" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
