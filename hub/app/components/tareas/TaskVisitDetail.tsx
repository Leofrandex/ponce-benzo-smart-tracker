"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, MapPin } from "lucide-react";
import { fetchVisitDetail, anomalyLabel, type VisitDetail } from "@/app/lib/queries/visitDetail";
import { PhotoLightbox } from "@/app/components/clientes/PhotoLightbox";

// Detalle de la anomalía reportada (visita origen de la tarea).
// Se monta solo al expandir la card → el fetch (y el firmado de fotos) es perezoso.
export function TaskVisitDetail({ visitId }: { visitId: string }) {
  const [detail, setDetail] = useState<VisitDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setState("loading");
    fetchVisitDetail(visitId)
      .then((d) => { if (alive) { setDetail(d); setState("ready"); } })
      .catch(() => { if (alive) setState("error"); });
    return () => { alive = false; };
  }, [visitId]);

  if (state === "loading") return <p className="text-muted text-sm">Cargando reporte de la visita…</p>;
  if (state === "error" || !detail) return <p className="text-muted text-sm">No se pudo cargar el reporte de la visita origen.</p>;

  const fecha = new Date(detail.check_in_time).toLocaleString("es-VE", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div style={{ background: "var(--danger-bg)", borderRadius: "var(--radius-sm)", padding: "12px", marginBottom: "14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, marginBottom: "8px" }}>
        <AlertTriangle size={13} color="var(--danger)" />
        Anomalía reportada
        <span style={{ marginLeft: "auto", fontWeight: 400, color: "var(--text-muted)" }}>
          {[detail.merchandiser_name, fecha].filter(Boolean).join(" · ")}
        </span>
      </div>

      {(detail.anomaly_type ?? []).length > 0 && (
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "8px" }}>
          {(detail.anomaly_type ?? []).map((a) => (
            <span key={a} className="badge badge-danger">{anomalyLabel(a)}</span>
          ))}
        </div>
      )}

      <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: detail.photo_urls.length > 0 ? "10px" : "6px" }}>
        {detail.observations || "Sin observaciones."}
      </p>

      {detail.photo_urls.length > 0 && (
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
          {detail.photo_urls.map((url, idx) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt={`Foto ${idx + 1}`} onClick={() => setLightbox(idx)}
              style={{ width: 72, height: 72, objectFit: "cover", borderRadius: "var(--radius-sm)", cursor: "pointer" }} />
          ))}
        </div>
      )}

      <Link href={`/supervisor/tiendas/${detail.store_id}`} className="text-sm"
        style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: 600 }}>
        <MapPin size={12} /> Ver ficha de {detail.store_name ?? "la tienda"}
      </Link>

      {lightbox !== null && (
        <PhotoLightbox urls={detail.photo_urls} startIndex={lightbox} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
