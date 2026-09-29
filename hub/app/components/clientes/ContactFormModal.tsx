"use client";

import { useEffect, useId, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Trash2, X } from "lucide-react";
import type { Contact } from "@/app/lib/types";
import { DiscardChangesBar } from "./StoreFormModal";

export interface ContactFormValue {
  full_name: string;
  role_title: string;
  phone: string;
  email: string;
  birthday: string;
  is_primary: boolean;
}

type SaveResult = { error?: string };

interface ContactFormModalProps {
  open: boolean;
  contact: Contact | null; // null = crear nuevo
  onClose: () => void;
  // El modal solo se cierra si la operación salió bien; si falla, el error se muestra adentro.
  onSave: (value: ContactFormValue) => Promise<SaveResult>;
  onDelete?: () => Promise<SaveResult>; // solo al editar
}

function Field({ label, value, onChange, placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} style={{ display: "block", fontSize: "var(--text-2xs)", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", margin: "10px 0 4px" }}>
        {label}{required && " *"}
      </label>
      <input
        id={id}
        className="form-input"
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: "9px 12px", fontSize: "var(--text-sm)" }}
      />
    </div>
  );
}

export function ContactFormModal({ open, contact, onClose, onSave, onDelete }: ContactFormModalProps) {
  const [fullName, setFullName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthday, setBirthday] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initial, setInitial] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Re-hidratar al abrir (crear = vacío, editar = datos del contacto)
  useEffect(() => {
    if (!open) return;
    const v = {
      fullName: contact?.full_name ?? "",
      roleTitle: contact?.role_title ?? "",
      phone: contact?.phone ?? "",
      email: contact?.email ?? "",
      birthday: contact?.birthday ?? "",
      isPrimary: contact?.is_primary ?? false,
    };
    setFullName(v.fullName); setRoleTitle(v.roleTitle); setPhone(v.phone);
    setEmail(v.email); setBirthday(v.birthday); setIsPrimary(v.isPrimary);
    setInitial(JSON.stringify(v));
    setConfirmingDelete(false); setBusy(null); setError(null); setConfirmDiscard(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dirty = JSON.stringify({ fullName, roleTitle, phone, email, birthday, isPrimary }) !== initial;

  // Fondo y Esc: si hay cambios, piden confirmar en vez de cerrar.
  function requestClose() {
    if (busy) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (confirmDiscard) setConfirmDiscard(false);
      else requestClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const canSave = fullName.trim().length > 0;

  async function handleSave() {
    if (!canSave || busy) return;
    setBusy("save");
    setError(null);
    const { error: err } = await onSave({
      full_name: fullName.trim(),
      role_title: roleTitle.trim(),
      phone: phone.trim(),
      email: email.trim(),
      birthday: birthday.trim(),
      is_primary: isPrimary,
    });
    setBusy(null);
    if (err) { setError(`No se pudo guardar el contacto: ${err}`); return; }
    onClose();
  }

  async function handleDelete() {
    if (!onDelete || busy) return;
    setBusy("delete");
    setError(null);
    const { error: err } = await onDelete();
    setBusy(null);
    if (err) { setConfirmingDelete(false); setError(`No se pudo eliminar el contacto: ${err}`); return; }
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={requestClose}
          style={{
            position: "fixed", inset: 0, zIndex: 300,
            background: "rgba(10, 14, 26, 0.45)", backdropFilter: "blur(2px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-surface)", borderRadius: "var(--radius-lg)",
              padding: "20px", width: "min(400px, 100%)",
              boxShadow: "0 20px 50px rgba(0, 32, 92, 0.25)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2px" }}>
              <div style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--text-primary)" }}>
                {contact ? "Editar contacto" : "Nuevo contacto"}
              </div>
              <button onClick={onClose} aria-label="Cerrar" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}>
                <X size={18} />
              </button>
            </div>

            <Field label="Nombre" value={fullName} onChange={setFullName} placeholder="Nombre y apellido" required />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              <Field label="Rol" value={roleTitle} onChange={setRoleTitle} placeholder="Encargado, comprador…" />
              <Field label="Teléfono" value={phone} onChange={setPhone} placeholder="0414-555-0000" />
              <Field label="Correo" value={email} onChange={setEmail} placeholder="correo@ejemplo.com" />
              <Field label="Cumpleaños" value={birthday} onChange={setBirthday} placeholder="dd/mm" />
            </div>

            <button
              type="button"
              aria-pressed={isPrimary}
              aria-label="Encargado de tienda"
              onClick={() => setIsPrimary((p) => !p)}
              className="focus-ring"
              style={{
                display: "flex", alignItems: "center", gap: "8px", marginTop: "14px",
                background: "transparent", border: "none", cursor: "pointer", padding: 0,
                fontFamily: "inherit", fontSize: "var(--text-xs)", fontWeight: 600,
                color: isPrimary ? "var(--warning)" : "var(--text-muted)",
              }}
            >
              <Star size={15} color="var(--warning)" fill={isPrimary ? "var(--warning)" : "none"} aria-hidden />
              {isPrimary ? "Encargado de tienda" : "Marcar como encargado de tienda"}
            </button>

            {error && (
              <div role="alert" style={{ fontSize: "var(--text-xs)", color: "var(--danger)", marginTop: "12px" }}>{error}</div>
            )}

            {confirmDiscard ? (
              <DiscardChangesBar onKeep={() => setConfirmDiscard(false)} onDiscard={onClose} />
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "18px" }}>
                {contact && onDelete && (
                  confirmingDelete ? (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={busy !== null}
                      className="btn btn-sm"
                      style={{ width: "auto", background: "var(--danger)", color: "#fff" }}
                    >
                      {busy === "delete" ? "Eliminando…" : "¿Confirmar eliminación?"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(true)}
                      disabled={busy !== null}
                      className="btn btn-sm"
                      style={{ width: "auto", background: "var(--danger-bg)", color: "var(--danger)", display: "flex", alignItems: "center", gap: "5px" }}
                    >
                      <Trash2 size={13} /> Eliminar
                    </button>
                  )
                )}
                <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
                  <button type="button" onClick={onClose} disabled={busy !== null} className="btn btn-secondary btn-sm" style={{ width: "auto" }}>
                    Cancelar
                  </button>
                  <button type="button" onClick={handleSave} disabled={!canSave || busy !== null} className="btn btn-primary btn-sm" style={{ width: "auto" }}>
                    {busy === "save" ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
