"use client";

import { useState } from "react";
import { User, Phone, Mail, Star, Pencil, Plus } from "lucide-react";
import type { Contact } from "@/app/lib/types";
import { ContactFormModal, type ContactFormValue } from "./ContactFormModal";

export function ContactList({ storeId, contacts }: { storeId: string; contacts: Contact[] }) {
  // Mock-first: estado local sembrado con los contactos existentes.
  const [items, setItems] = useState<Contact[]>(contacts);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null); // null = crear nuevo

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(contact: Contact) {
    setEditing(contact);
    setModalOpen(true);
  }

  function handleSave(value: ContactFormValue) {
    setItems((prev) => {
      let next: Contact[];
      if (editing) {
        next = prev.map((c) =>
          c.contact_id === editing.contact_id
            ? {
                ...c,
                full_name: value.full_name,
                role_title: value.role_title || null,
                phone: value.phone || null,
                email: value.email || null,
                birthday: value.birthday || null,
                is_primary: value.is_primary,
              }
            : c,
        );
      } else {
        next = [
          ...prev,
          {
            contact_id: `contact-${Date.now()}`,
            store_id: storeId,
            full_name: value.full_name,
            role_title: value.role_title || null,
            phone: value.phone || null,
            email: value.email || null,
            birthday: value.birthday || null,
            is_primary: value.is_primary,
            active: true,
            created_at: new Date().toISOString(),
          },
        ];
      }
      // Encargado único: marcar uno desmarca a los demás.
      if (value.is_primary) {
        const savedId = editing?.contact_id ?? next[next.length - 1].contact_id;
        next = next.map((c) => (c.contact_id === savedId ? c : { ...c, is_primary: false }));
      }
      // Encargado primero, como en el orden original.
      return [...next].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
    });
  }

  function handleDelete() {
    if (!editing) return;
    setItems((prev) => prev.filter((c) => c.contact_id !== editing.contact_id));
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
        <div className="section-title">Contactos ({items.length})</div>
        <button type="button" onClick={openCreate} className="filter-chip" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <Plus size={12} /> Agregar
        </button>
      </div>
      {items.length === 0 ? (
        <div className="card" style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>Sin contactos registrados.</div>
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
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>{c.full_name}</span>
                    {c.is_primary && <Star size={12} color="var(--warning)" fill="var(--warning)" />}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{c.role_title ?? "—"}</div>
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
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "12px" }}>
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
