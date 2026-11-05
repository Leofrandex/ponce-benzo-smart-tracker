"use client";

import { useState } from "react";
import { useSupabaseQuery } from "@/app/lib/hooks/useSupabaseQuery";
import { fetchCambiosGps, leerCoordenadasRestauracion, restaurarGps, type CambioGps } from "@/app/lib/queries/gpsHistorial";
import SectionError from "@/app/components/ui/SectionError";

const TIPO: Record<CambioGps["kind"], string> = { captura: "Captura", restauracion: "Restauración", edicion: "Edición" };
const fmt = (lat: number | null, lng: number | null) => (lat != null && lng != null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "Sin GPS");

// Historial de cambios del GPS de la tienda (más reciente primero). Sin cambios no se muestra.
export function GpsHistorial({ storeId, canRestore, onRestored }: { storeId: string; canRestore: boolean; onRestored: () => void }) {
  const { data, error, refetch } = useSupabaseQuery(() => fetchCambiosGps([storeId]), [storeId], "store:gps");
  // Fila en confirmación, con las coordenadas leídas en el momento de pedirla.
  const [pend, setPend] = useState<{ id: string; lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (error) return <div className="card" style={{ padding: "4px 16px" }}><SectionError what="el historial de GPS" detail={error} onRetry={refetch} compact /></div>;
  if (!data || data.length === 0) return null;
  const filas = [...data].reverse();

  const pedir = async (id: string) => {
    setMsg(null); setBusy(true);
    try {
      const c = await leerCoordenadasRestauracion(id);
      if (c.lat == null || c.lng == null) setMsg("Esa fila ya no tiene coordenadas anteriores.");
      else setPend({ id, lat: c.lat, lng: c.lng });
    } catch (e) { setMsg(e instanceof Error ? e.message : "No se pudo leer el historial."); }
    setBusy(false);
  };

  const confirmar = async () => {
    if (!pend) return;
    setBusy(true);
    const { error: err } = await restaurarGps(pend.id);
    setBusy(false);
    if (err) { setMsg(err); return; }
    setPend(null); setMsg(null);
    await Promise.all([refetch(), Promise.resolve(onRestored())]);
  };

  return (
    <div className="card" style={{ padding: "12px 16px" }}>
      <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>Historial de GPS</div>
      {msg && <div role="alert" style={{ fontSize: "var(--text-xs)", color: "var(--danger)", marginBottom: "6px" }}>{msg}</div>}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
        {filas.map((c) => (
          <li key={c.history_id} style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
              <span>{new Date(c.changed_at).toLocaleString("es-VE", { dateStyle: "medium", timeStyle: "short" })} · {c.changed_by_name ?? "Sistema"}</span>
              <span className="badge">{TIPO[c.kind]}</span>
            </div>
            <div style={{ fontFamily: "monospace", fontVariantNumeric: "tabular-nums", marginTop: "2px" }}>
              {fmt(c.old_lat, c.old_lng)} → {fmt(c.new_lat, c.new_lng)}
            </div>
            {canRestore && c.old_lat != null && c.old_lng != null && (
              pend?.id === c.history_id ? (
                <div style={{ marginTop: "4px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <span>La tienda quedará en {fmt(pend.lat, pend.lng)}.</span>
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={confirmar}>Confirmar</button>
                  <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setPend(null)}>Cancelar</button>
                </div>
              ) : (
                <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: "4px" }} disabled={busy} onClick={() => pedir(c.history_id)}>Restaurar</button>
              )
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
