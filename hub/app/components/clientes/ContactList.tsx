"use client";

import { useState } from "react";
import { User, Phone, Mail, Star, Pencil, Plus } from "lucide-react";
import type { Contact } from "@/app/lib/types";
import SectionError from "@/app/components/ui/SectionError";
import { ContactFormModal, type ContactFormValue } from "./ContactFormModal";
import { SkeletonList } from "@/app/components/ui/Skeleton";

interface ContactListProps {
  storeId: string;
  contacts: Contact[] | null; // null = todavía cargando
  error?: string | null;
  onRetry?: () => void;
  onCreate: (value: ContactFormValue) => Promise<{ error?: string }>;
  onUpdate: (contactId: string, value: ContactFormValue) => Promise<{ error?: string }>;
  onDelete: (contactId: string) => Promise<{ error?: string }>;
}

export function ContactList({ storeId: _storeId, contacts, error, onRetry, onCreate, onUpdate, onDelete }: ContactListProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const items = contacts ?? []; // controlado por el padre

  function openCreate() { setEditing(null); setModalOpen(true); }
  function openEdit(contact: Contact) { setEditing(contact); setModalOpen(true); }

  // El modal se cierra solo si la operación salió bien (lo decide ContactFormModal).
  function handleSave(value: ContactFormValue) {
    return editing ? onUpdate(editing.contact_id, value) : onCreate(value);
  }
  function handleDelete() {
    return editing ? onDelete(editing.contact_id) : Promise.resolve({});
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
        <div className="section-title">Contactos{contacts ? ` (${items.length})` : ""}</div>
        <button type="button" onClick={openCreate} className="filter-chip" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <Plus size={12} /> Agregar
        </button>
      </div>
      {error ? (
        <div className="card" style={{ padding: "4px 14px" }}>
          <SectionError what="los contactos" detail={error} onRetry={onRetry} compact />
        </div>
      ) : contacts === null ? (
        <div className="card" style={{ padding: "4px 16px" }}><SkeletonList rows={3} /></div>
      ) : items.length === 0 ? (
        <div className="card" style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>Sin contactos registrados.</div>
      ) : (
        <div className="card" style={{ padding: "4px 14px", height: "175px", overflowY: "auto" }}>
          {items.map((c, idx) => (
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
                    <span style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--text-primary)" }}>{c.full_name}</span>
                    {c.is_primary && <Star size={12} color="var(--warning)" fill="var(--warning)" />}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{c.role_title ?? "—"}</div>
                </div>
                <button
                  type="button"
                  onClick={() => openEdit(c)}
                  aria-label={`Editar ${c.full_name}`}
                  style={{
                    width: 26, height: 26, borderRadius: "var(--radius-sm)", flexShrink: 0,
                    background: "var(--bg-elevated)", border: "1px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--text-muted)", cursor: "pointer",
                  }}
                >
                  <Pencil size={12} />
                </button>
              </div>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "var(--text-xs)" }}>
                {c.phone && <a href={`tel:${c.phone}`} style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--accent)", textDecoration: "none" }}><Phone size={12} /> {c.phone}</a>}
                {c.email && <a href={`mailto:${c.email}`} style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--accent)", textDecoration: "none" }}><Mail size={12} /> {c.email}</a>}
              </div>
            </div>
          ))}
        </div>
      )}

      <ContactFormModal
        open={modalOpen}
        contact={editing}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onDelete={editing ? handleDelete : undefined}
      />
    </div>
  );
}
