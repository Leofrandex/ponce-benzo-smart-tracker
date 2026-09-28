"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useSupabaseQuery } from "@/app/lib/hooks/useSupabaseQuery";
import { fetchCatalog, filterCatalog } from "@/app/lib/queries/products";
import { validarFechaReposicion } from "@/app/lib/queries/restocks";
import { hoyCaracas } from "@/app/lib/queries/taskFilters";
import { registrarReposicion } from "@/app/lib/mutations/restocks";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", margin: "10px 0 4px" }}>
      {children}
    </div>
  );
}

export function RestockFormModal({ open, storeId, onClose, onSaved }: {
  open: boolean; storeId: string; onClose: () => void; onSaved: () => void;
}) {
  const hoy = hoyCaracas();
  const { data: catalog } = useSupabaseQuery(fetchCatalog, []);
  const [fecha, setFecha] = useState(hoy);
  const [productos, setProductos] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Cada apertura empieza limpia.
  useEffect(() => {
    if (open) { setFecha(hoyCaracas()); setProductos([]); setQ(""); setNota(""); setError(null); setSaving(false); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const activos = useMemo(() => (catalog ?? []).filter((p) => p.active), [catalog]);
  const visibles = useMemo(() => filterCatalog(activos, q, false), [activos, q]);
  const toggle = (id: string) => setProductos((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);

  const guardar = async () => {
    const invalida = validarFechaReposicion(fecha, hoyCaracas());
    if (invalida) { setError(invalida); return; }
    setSaving(true);
    const { error: err } = await registrarReposicion({ storeId, fecha, productos, nota });
    setSaving(false);
    if (err) { setError(err); return; }
    onSaved();
  };

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
              padding: "20px", width: "min(420px, 100%)",
              boxShadow: "0 20px 50px rgba(0, 32, 92, 0.25)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2px" }}>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                Registrar reposición
              </div>
              <button onClick={onClose} aria-label="Cerrar" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}>
                <X size={18} />
              </button>
            </div>

            <FieldLabel>Fecha</FieldLabel>
            <input
              type="date"
              className="form-input"
              value={fecha}
              max={hoy}
              onChange={(e) => setFecha(e.target.value)}
              style={{ padding: "9px 12px", fontSize: "13px" }}
            />

            <FieldLabel>Productos repuestos (opcional)</FieldLabel>
            <input
              className="form-input"
              value={q}
              placeholder="Buscar por nombre, SKU o marca"
              onChange={(e) => setQ(e.target.value)}
              style={{ padding: "9px 12px", fontSize: "13px" }}
            />
            <div style={{ maxHeight: "240px", overflowY: "auto", marginTop: "6px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
              {visibles.length === 0 ? (
                <div style={{ padding: "12px", fontSize: "12px", color: "var(--text-muted)" }}>Sin resultados.</div>
              ) : (
                visibles.map((p) => (
                  <label
                    key={p.product_id}
                    style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", fontSize: "13px", color: "var(--text-primary)", borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                  >
                    <input type="checkbox" checked={productos.includes(p.product_id)} onChange={() => toggle(p.product_id)} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={p.name}>{p.name}</span>
                    {p.brand && <span style={{ flexShrink: 0, fontSize: "11px", color: "var(--text-muted)" }}>{p.brand}</span>}
                  </label>
                ))
              )}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
              {productos.length} seleccionado{productos.length === 1 ? "" : "s"}
            </div>

            <FieldLabel>Nota (opcional)</FieldLabel>
            <textarea
              className="form-input"
              rows={2}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              style={{ padding: "9px 12px", fontSize: "13px", resize: "vertical" }}
            />

            {error && (
              <div style={{ fontSize: "12px", color: "var(--danger)", marginTop: "10px" }}>{error}</div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "18px" }}>
              <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
                <button type="button" onClick={onClose} className="btn btn-secondary btn-sm" style={{ width: "auto" }}>
                  Cancelar
                </button>
                <button type="button" onClick={guardar} disabled={saving} className="btn btn-primary btn-sm" style={{ width: "auto" }}>
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
