"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { ClienteInput } from "@/app/lib/types";
import { CANALES, CANAL_LABEL } from "@/app/lib/carga/canales";
import { faltantesCliente } from "@/app/lib/carga/obligatorios";
import { useSupabaseQuery } from "@/app/lib/hooks/useSupabaseQuery";
import { fetchVendorAssignmentData } from "@/app/lib/queries/config";
import { DiscardChangesBar, Field } from "./StoreFormModal";

const LABEL_STYLE: React.CSSProperties = {
  display: "block", fontSize: "var(--text-2xs)", color: "var(--text-muted)", fontWeight: 600,
  textTransform: "uppercase", letterSpacing: "0.5px", margin: "10px 0 4px",
};

interface ClientFormModalProps {
  open: boolean;
  onClose: () => void;
  // El modal solo se cierra si el guardado salió bien; si falla (p. ej. nombre repetido) el error se ve adentro.
  onSave: (input: ClienteInput) => Promise<{ error?: string }>;
}

export function ClientFormModal({ open, onClose, onSave }: ClientFormModalProps) {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("");
  const [rif, setRif] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const channelLabelId = useId();
  const vendedorSelectId = useId();

  const { data } = useSupabaseQuery(fetchVendorAssignmentData, [], "config:vendedores");
  const vendedores = useMemo(
    () => (data?.users ?? []).filter((u) => u.role === "vendedor" && u.active),
    [data],
  );

  useEffect(() => {
    if (!open) return;
    setName(""); setChannel(""); setRif(""); setVendedorId("");
    setSaving(false); setError(null); setConfirmDiscard(false);
  }, [open]);

  const dirty = !!(name || channel || rif || vendedorId);
  function requestClose() {
    if (saving) return;
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

  const input: ClienteInput = { name, business_channel: channel, rif, vendedor_id: vendedorId || null };
  const faltantes = faltantesCliente(input);
  const canSave = faltantes.length === 0;

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    const { error: err } = await onSave(input);
    setSaving(false);
    if (err) { setError(err); return; }
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
              padding: "20px", width: "min(440px, 100%)", maxHeight: "90vh", overflowY: "auto",
              boxShadow: "0 20px 50px rgba(0, 32, 92, 0.25)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2px" }}>
              <div style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--text-primary)" }}>Nuevo cliente</div>
              <button onClick={onClose} aria-label="Cerrar" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}>
                <X size={18} />
              </button>
            </div>

            <Field label="Nombre" value={name} onChange={setName} required />

            <div id={channelLabelId} style={LABEL_STYLE}>Canal *</div>
            <div role="group" aria-labelledby={channelLabelId} style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
              {CANALES.map((c) => (
                <button key={c} type="button"
                  aria-pressed={channel === c}
                  className={`filter-chip focus-ring ${channel === c ? "active" : ""}`}
                  onClick={() => setChannel(channel === c ? "" : c)}>
                  {CANAL_LABEL[c]}
                </button>
              ))}
            </div>

            <Field label="RIF (opcional)" value={rif} onChange={setRif} placeholder="J-12345678-9" />

            <label htmlFor={vendedorSelectId} style={LABEL_STYLE}>Vendedor (opcional)</label>
            <select id={vendedorSelectId} className="form-input" value={vendedorId} onChange={(e) => setVendedorId(e.target.value)}
              style={{ padding: "9px 12px", fontSize: "var(--text-sm)" }}>
              <option value="">Sin vendedor</option>
              {vendedores.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>

            {error && (
              <div role="alert" style={{ fontSize: "var(--text-xs)", color: "var(--danger)", marginTop: "12px" }}>
                No se pudo guardar el cliente: {error}
              </div>
            )}

            {confirmDiscard ? (
              <DiscardChangesBar onKeep={() => setConfirmDiscard(false)} onDiscard={onClose} />
            ) : (
              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "8px", marginTop: "18px" }}>
                {faltantes.length > 0 && (
                  <span style={{ flex: 1, fontSize: "var(--text-2xs)", color: "var(--text-muted)" }}>
                    Falta: {faltantes.join(", ")}
                  </span>
                )}
                <button type="button" onClick={onClose} disabled={saving} className="btn btn-secondary btn-sm" style={{ width: "auto" }}>
                  Cancelar
                </button>
                <button type="button" onClick={handleSave} disabled={!canSave || saving} className="btn btn-primary btn-sm" style={{ width: "auto" }}>
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
