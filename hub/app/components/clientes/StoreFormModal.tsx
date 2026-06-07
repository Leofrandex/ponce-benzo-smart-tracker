"use client";

import { useEffect, useState } from "react";
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
  store: Store;
  onClose: () => void;
  onSave: (store: Store) => void;
}

function Field({ label, value, onChange, placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", margin: "10px 0 4px" }}>
        {label}{required && " *"}
      </div>
      <input
        className="form-input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: "9px 12px", fontSize: "13px" }}
      />
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

  // Re-hidratar al abrir
  useEffect(() => {
    if (!open) return;
    setName(store.name);
    setAddress(store.address ?? "");
    setEstado(store.estado ?? "");
    setMunicipio(store.municipio ?? "");
    setUrbanizacion(store.urbanizacion ?? "");
    setChannel(store.business_channel ?? "");
    setClassification(store.classification ?? "");
    setLat(String(store.master_lat));
    setLng(String(store.master_lng));
    setActive(store.active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const latNum = Number(lat);
  const lngNum = Number(lng);
  const coordsValid =
    lat.trim() !== "" && lng.trim() !== "" &&
    Number.isFinite(latNum) && Number.isFinite(lngNum) &&
    latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180;
  const canSave = name.trim().length > 0 && coordsValid;

  function handleSave() {
    if (!canSave) return;
    onSave({
      ...store,
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
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
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
              <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>Editar sucursal</div>
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

            <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", margin: "10px 0 4px" }}>Canal</div>
            <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
              {CHANNELS.map((c) => (
                <button key={c} type="button"
                  className={`filter-chip ${channel === c ? "active" : ""}`}
                  onClick={() => setChannel(channel === c ? "" : c)}>
                  {CHANNEL_LABELS[c]}
                </button>
              ))}
            </div>

            <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", margin: "12px 0 4px" }}>Clasificación</div>
            <div style={{ display: "flex", gap: "5px" }}>
              {["A", "B", "C"].map((c) => (
                <button key={c} type="button"
                  className={`filter-chip ${classification === c ? "active" : ""}`}
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
              <div style={{ fontSize: "11px", color: "var(--danger)", marginTop: "4px" }}>
                Las coordenadas deben ser números válidos (lat −90 a 90, lng −180 a 180).
              </div>
            )}

            <button
              type="button"
              onClick={() => setActive((a) => !a)}
              style={{
                display: "flex", alignItems: "center", gap: "8px", marginTop: "14px",
                background: "transparent", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit",
              }}
            >
              <span style={{
                width: 32, height: 18, borderRadius: 999, padding: 2, boxSizing: "border-box",
                background: active ? "var(--success)" : "var(--bg-elevated)",
                border: "1px solid var(--border)",
                display: "flex", justifyContent: active ? "flex-end" : "flex-start",
                transition: "background var(--duration) var(--ease)",
              }}>
                <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }} />
              </span>
              <span style={{ fontSize: "12px", fontWeight: 600, color: active ? "var(--success)" : "var(--text-muted)" }}>
                {active ? "Sucursal activa" : "Sucursal inactiva"}
              </span>
            </button>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "18px" }}>
              <button type="button" onClick={onClose} className="btn btn-secondary btn-sm" style={{ width: "auto" }}>
                Cancelar
              </button>
              <button type="button" onClick={handleSave} disabled={!canSave} className="btn btn-primary btn-sm" style={{ width: "auto" }}>
                Guardar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
