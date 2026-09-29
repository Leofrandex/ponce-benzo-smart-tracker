"use client";

import { useEffect, useId, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { Store } from "@/app/lib/types";

const CHANNELS = ["drogueria", "farmacia", "supermercado", "autoservicio", "mayorista", "otro"] as const;
const CHANNEL_LABELS: Record<string, string> = {
  drogueria: "Droguería", farmacia: "Farmacia", supermercado: "Supermercado",
  autoservicio: "Autoservicio", mayorista: "Mayorista", otro: "Otro",
};

interface StoreFormModalProps {
  open: boolean;
  store: Store | null; // null = crear nueva sucursal
  onClose: () => void;
  // El modal solo se cierra si el guardado salió bien; si falla, el error se muestra adentro.
  onSave: (store: Store) => Promise<{ error?: string }>;
}

// Coordenadas provisionales (centro de Caracas) para sucursales nuevas,
// igual que la convención de la ingesta de datos.
const DEFAULT_LAT = "10.4806";
const DEFAULT_LNG = "-66.9036";

const LABEL_STYLE: React.CSSProperties = {
  display: "block", fontSize: "var(--text-2xs)", color: "var(--text-muted)", fontWeight: 600,
  textTransform: "uppercase", letterSpacing: "0.5px", margin: "10px 0 4px",
};

function Field({ label, value, onChange, placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} style={LABEL_STYLE}>
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

// Franja de confirmación inline: aparece cuando se intenta cerrar (fondo o Esc) con cambios sin guardar.
export function DiscardChangesBar({ onKeep, onDiscard }: { onKeep: () => void; onDiscard: () => void }) {
  return (
    <div
      role="alert"
      style={{
        display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "18px",
        padding: "10px 12px", borderRadius: "var(--radius-md)",
        background: "var(--warning-bg)", border: "1px solid var(--border)",
      }}
    >
      <span style={{ flex: 1, minWidth: "160px", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
        Tenés cambios sin guardar.
      </span>
      <button type="button" autoFocus onClick={onKeep} className="btn btn-secondary btn-sm" style={{ width: "auto" }}>
        Seguir editando
      </button>
      <button type="button" onClick={onDiscard} className="btn btn-sm" style={{ width: "auto", background: "var(--danger)", color: "#fff" }}>
        Descartar
      </button>
    </div>
  );
}

export function StoreFormModal({ open, store, onClose, onSave }: StoreFormModalProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [estado, setEstado] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [urbanizacion, setUrbanizacion] = useState("");
  const [channel, setChannel] = useState<string>("");
  const [classification, setClassification] = useState<string>("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initial, setInitial] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const channelLabelId = useId();
  const classLabelId = useId();

  const snapshot = (v: { name: string; address: string; estado: string; municipio: string; urbanizacion: string; channel: string; classification: string; lat: string; lng: string; active: boolean }) =>
    JSON.stringify(v);

  // Re-hidratar al abrir (crear = defaults, editar = datos de la sucursal)
  useEffect(() => {
    if (!open) return;
    const v = {
      name: store?.name ?? "",
      address: store?.address ?? "",
      estado: store?.estado ?? "",
      municipio: store?.municipio ?? "",
      urbanizacion: store?.urbanizacion ?? "",
      channel: store?.business_channel ?? "",
      classification: store?.classification ?? "",
      lat: store ? String(store.master_lat) : DEFAULT_LAT,
      lng: store ? String(store.master_lng) : DEFAULT_LNG,
      active: store?.active ?? true,
    };
    setName(v.name); setAddress(v.address); setEstado(v.estado); setMunicipio(v.municipio);
    setUrbanizacion(v.urbanizacion); setChannel(v.channel); setClassification(v.classification);
    setLat(v.lat); setLng(v.lng); setActive(v.active);
    setInitial(snapshot(v));
    setSaving(false); setError(null); setConfirmDiscard(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dirty = snapshot({ name, address, estado, municipio, urbanizacion, channel, classification, lat, lng, active }) !== initial;

  // Fondo y Esc: si hay cambios, piden confirmar en vez de cerrar.
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

  const latNum = Number(lat);
  const lngNum = Number(lng);
  const coordsValid =
    lat.trim() !== "" && lng.trim() !== "" &&
    Number.isFinite(latNum) && Number.isFinite(lngNum) &&
    latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180;
  const canSave = name.trim().length > 0 && coordsValid;

  async function handleSave() {
    if (!canSave || saving) return;
    const base: Store = store ?? {
      store_id: `store-${Date.now()}`,
      name: "",
      address: null,
      master_lat: 0,
      master_lng: 0,
      active: true,
      created_at: new Date().toISOString(),
      contact_name: null,
      contact_phone: null,
      contact_email: null,
      estado: null,
      municipio: null,
      urbanizacion: null,
      business_channel: null,
      classification: null,
    };
    setSaving(true);
    setError(null);
    const { error: err } = await onSave({
      ...base,
      name: name.trim(),
      address: address.trim() || null,
      estado: estado.trim() || null,
      municipio: municipio.trim() || null,
      urbanizacion: urbanizacion.trim() || null,
      business_channel: (channel || null) as Store["business_channel"],
      classification: (classification || null) as Store["classification"],
      master_lat: latNum,
      master_lng: lngNum,
      active,
    });
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
              <div style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--text-primary)" }}>
                {store ? "Editar sucursal" : "Nueva sucursal"}
              </div>
              <button onClick={onClose} aria-label="Cerrar" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}>
                <X size={18} />
              </button>
            </div>

            <Field label="Nombre" value={name} onChange={setName} required />
            <Field label="Dirección" value={address} onChange={setAddress} placeholder="Av. Principal, Local 3" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 10px" }}>
              <Field label="Estado" value={estado} onChange={setEstado} placeholder="Miranda" />
              <Field label="Municipio" value={municipio} onChange={setMunicipio} placeholder="Chacao" />
              <Field label="Urbanización" value={urbanizacion} onChange={setUrbanizacion} placeholder="El Rosal" />
            </div>

            <div id={channelLabelId} style={{ ...LABEL_STYLE }}>Canal</div>
            <div role="group" aria-labelledby={channelLabelId} style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
              {CHANNELS.map((c) => (
                <button key={c} type="button"
                  aria-pressed={channel === c}
                  className={`filter-chip focus-ring ${channel === c ? "active" : ""}`}
                  onClick={() => setChannel(channel === c ? "" : c)}>
                  {CHANNEL_LABELS[c]}
                </button>
              ))}
            </div>

            <div id={classLabelId} style={{ ...LABEL_STYLE, margin: "12px 0 4px" }}>Clasificación</div>
            <div role="group" aria-labelledby={classLabelId} style={{ display: "flex", gap: "5px" }}>
              {["A", "B", "C"].map((c) => (
                <button key={c} type="button"
                  aria-pressed={classification === c}
                  className={`filter-chip focus-ring ${classification === c ? "active" : ""}`}
                  onClick={() => setClassification(classification === c ? "" : c)}>
                  {c}
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              <Field label="Latitud" value={lat} onChange={setLat} placeholder="10.4806" />
              <Field label="Longitud" value={lng} onChange={setLng} placeholder="-66.9036" />
            </div>
            {!coordsValid && (
              <div style={{ fontSize: "var(--text-2xs)", color: "var(--danger)", marginTop: "4px" }}>
                Las coordenadas deben ser números válidos (lat −90 a 90, lng −180 a 180).
              </div>
            )}

            <button
              type="button"
              role="switch"
              aria-checked={active}
              aria-label="Sucursal activa"
              onClick={() => setActive((a) => !a)}
              className="focus-ring"
              style={{
                display: "flex", alignItems: "center", gap: "8px", marginTop: "14px",
                background: "transparent", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit",
              }}
            >
              <span aria-hidden style={{
                width: 32, height: 18, borderRadius: 999, padding: 2, boxSizing: "border-box",
                background: active ? "var(--success)" : "var(--bg-elevated)",
                border: "1px solid var(--border)",
                display: "flex", justifyContent: active ? "flex-end" : "flex-start",
                transition: "background var(--duration) var(--ease)",
              }}>
                <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }} />
              </span>
              <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: active ? "var(--success)" : "var(--text-muted)" }}>
                {active ? "Sucursal activa" : "Sucursal inactiva"}
              </span>
            </button>

            {error && (
              <div role="alert" style={{ fontSize: "var(--text-xs)", color: "var(--danger)", marginTop: "12px" }}>
                No se pudo guardar la sucursal: {error}
              </div>
            )}

            {confirmDiscard ? (
              <DiscardChangesBar onKeep={() => setConfirmDiscard(false)} onDiscard={onClose} />
            ) : (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "18px" }}>
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
