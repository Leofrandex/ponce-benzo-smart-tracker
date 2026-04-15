"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Camera, Navigation2, CheckCircle2, AlertTriangle,
  ShieldAlert, Loader2, MapPin, CloudOff,
} from "lucide-react";
import type { VisitRecord } from "@/app/lib/types";
import { mockStores } from "@/app/lib/mock-data";

type GeoState = "idle" | "searching" | "granted" | "denied";
type Status = "completed" | "skipped" | "anomaly";

interface StoreInfo {
  store_id: string;
  name: string;
  address: string | null;
}

const isMobileDevice = () =>
  typeof window !== "undefined" &&
  /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

function resolveStore(storeId: string): StoreInfo | null {
  // Check mock stores first
  const mock = mockStores.find((s) => s.store_id === storeId);
  if (mock) return { store_id: mock.store_id, name: mock.name, address: mock.address };

  // Check sessionStorage extra stores
  const extras: StoreInfo[] = JSON.parse(
    typeof window !== "undefined" ? sessionStorage.getItem("pv_extra_stores") || "[]" : "[]"
  );
  return extras.find((s) => s.store_id === storeId) ?? null;
}

export default function CheckInPage({ params }: { params: { storeId: string } }) {
  const { storeId } = params;
  const router = useRouter();

  const [store, setStore]           = useState<StoreInfo | null | undefined>(undefined);
  const [geoState, setGeoState]     = useState<GeoState>("searching");
  const [coords, setCoords]         = useState<{ lat: number; lng: number } | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [observations, setObservations] = useState("");
  const [status, setStatus]         = useState<Status>("completed");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [showWebcam, setShowWebcam] = useState(false);

  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Resolve store from mock data or sessionStorage extra stores
    const extras: StoreInfo[] = JSON.parse(sessionStorage.getItem("pv_extra_stores") || "[]");
    const extraMatch = extras.find((s) => s.store_id === storeId);
    if (extraMatch) { setStore(extraMatch); return; }

    const mock = mockStores.find((s) => s.store_id === storeId);
    setStore(mock ? { store_id: mock.store_id, name: mock.name, address: mock.address } : null);
  }, [storeId]);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoState("granted");
      },
      () => setGeoState("denied"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  if (store === undefined) {
    return (
      <div className="app-shell">
        <div className="empty-state">
          <Loader2 size={36} color="var(--accent-light)" style={{ animation: "spin 0.7s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="app-shell">
        <div className="empty-state">
          <MapPin size={52} color="var(--text-muted)" strokeWidth={1} />
          <div className="empty-title">Tienda no encontrada</div>
          <button className="btn btn-secondary btn-sm" onClick={() => router.back()}>Volver</button>
        </div>
      </div>
    );
  }

  const handleOpenCamera = async () => {
    if (isMobileDevice()) {
      fileInputRef.current?.click();
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: 1280, height: 720 },
        });
        streamRef.current = stream;
        setShowWebcam(true);
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
        }, 100);
      } catch {
        alert("No se pudo acceder a la cámara. Verifica los permisos del navegador.");
      }
    }
  };

  const handleMobilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCaptureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    setPhotoDataUrl(canvas.toDataURL("image/jpeg", 0.85));
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setShowWebcam(false);
  };

  const handleCloseWebcam = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setShowWebcam(false);
  };

  const handleSubmit = () => {
    if (!photoDataUrl) {
      alert("La foto del punto de venta es obligatoria. Captura una imagen para continuar.");
      return;
    }
    setSubmitting(true);

    const visitRecord: VisitRecord = {
      visit_id:          crypto.randomUUID(),
      store_id:          storeId,
      check_in_time:     new Date().toISOString(),
      check_in_location: coords,
      observations,
      status,
      synced:            false,
    };

    const existing = JSON.parse(sessionStorage.getItem("pv_visits") || "[]");
    sessionStorage.setItem("pv_visits", JSON.stringify([...existing, visitRecord]));

    const statuses = JSON.parse(sessionStorage.getItem("pv_store_statuses") || "{}");
    statuses[storeId] = status;
    sessionStorage.setItem("pv_store_statuses", JSON.stringify(statuses));

    setSubmitting(false);
    setSubmitted(true);
  };

  if (submitted) {
    const StatusIcon = { completed: CheckCircle2, skipped: AlertTriangle, anomaly: ShieldAlert }[status];
    const statusColor = { completed: "var(--success)", skipped: "var(--warning)", anomaly: "var(--danger)" }[status];
    const statusLabel = { completed: "completada", skipped: "omitida", anomaly: "con anomalía" }[status];

    return (
      <div className="app-shell">
        <main className="main-content" style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <StatusIcon size={72} color={statusColor} strokeWidth={1.2} />
          <h2 style={{ fontSize: "22px", fontWeight: 800 }}>Visita registrada</h2>
          <p className="text-muted text-sm" style={{ maxWidth: "260px", lineHeight: 1.6 }}>
            {store.name} fue registrada como{" "}
            <strong style={{ color: "var(--text-primary)" }}>{statusLabel}</strong>.
          </p>
          <div className="sync-banner" style={{ maxWidth: "100%" }}>
            <CloudOff size={14} />
            Guardado localmente — pendiente de sincronización.
          </div>
          <button
            id="btn-back-to-route"
            className="btn btn-primary"
            style={{ maxWidth: "280px" }}
            onClick={() => router.push("/ruta")}
          >
            <ArrowLeft size={16} />
            Volver a mi ruta
          </button>
        </main>
      </div>
    );
  }

  const statusOptions: { value: Status; Icon: React.ElementType; label: string }[] = [
    { value: "completed", Icon: CheckCircle2,  label: "Completado" },
    { value: "skipped",   Icon: AlertTriangle, label: "Omitido"    },
    { value: "anomaly",   Icon: ShieldAlert,   label: "Anomalía"   },
  ];

  const gpsLabel =
    geoState === "searching" ? "Obteniendo GPS..." :
    geoState === "granted"   ? `${coords?.lat.toFixed(4)}°, ${coords?.lng.toFixed(4)}°` :
    "GPS no disponible";

  return (
    <div className="app-shell">
      <header className="header">
        <button
          className="btn btn-secondary btn-sm"
          style={{ padding: "6px 12px", width: "auto", display: "flex", alignItems: "center", gap: "6px" }}
          onClick={() => router.back()}
        >
          <ArrowLeft size={15} />
          Atrás
        </button>
        <span className="header-title">Check-in</span>
        <div />
      </header>

      <main className="main-content">
        <div className="card">
          <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "4px" }}>
            Registrando visita en
          </div>
          <div style={{ fontSize: "19px", fontWeight: 700 }}>{store.name}</div>
          <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "6px", display: "flex", alignItems: "center", gap: "5px" }}>
            <MapPin size={13} />
            {store.address}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`gps-chip ${geoState === "searching" ? "gps-searching" : geoState === "denied" ? "gps-error" : ""}`}>
            <span className="gps-dot" />
            <Navigation2 size={12} />
            {gpsLabel}
          </span>
        </div>

        <div className="form-group">
          <label className="form-label">Foto del punto de venta *</label>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={handleMobilePhotoChange}
          />

          {showWebcam && (
            <div className="modal-overlay">
              <div className="modal-sheet" style={{ maxHeight: "90vh", overflow: "hidden" }}>
                <div className="modal-handle" />
                <div className="modal-title">Cámara en vivo</div>
                <div style={{ position: "relative", background: "#000", borderRadius: "var(--radius-md)", overflow: "hidden", aspectRatio: "4/3" }}>
                  <video ref={videoRef} playsInline muted style={{ width: "100%", display: "block" }} />
                </div>
                <canvas ref={canvasRef} style={{ display: "none" }} />
                <button id="btn-capture-photo" className="btn btn-primary" onClick={handleCaptureFrame}>
                  <Camera size={16} />
                  Capturar foto
                </button>
                <button className="btn btn-secondary" onClick={handleCloseWebcam}>Cancelar</button>
              </div>
            </div>
          )}

          <div className={`camera-zone ${photoDataUrl ? "has-photo" : ""}`} onClick={handleOpenCamera} id="camera-zone">
            {photoDataUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoDataUrl} alt="Foto capturada" />
                <div className="camera-overlay">
                  <span style={{ background: "rgba(0,0,0,0.6)", padding: "6px 14px", borderRadius: "999px", fontSize: "12px", color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Camera size={13} />
                    Toca para cambiar la foto
                  </span>
                </div>
              </>
            ) : (
              <>
                <Camera size={40} color="var(--text-muted)" strokeWidth={1.2} />
                <span className="camera-label">
                  {isMobileDevice() ? "Toca para abrir la cámara" : "Toca para abrir la webcam"}
                </span>
                <span className="text-xs text-muted" style={{ textAlign: "center", paddingInline: "20px" }}>
                  Solo se permite captura en vivo — no se admiten fotos de la galería
                </span>
              </>
            )}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Estado de la visita</label>
          <div className="status-grid">
            {statusOptions.map((opt) => {
              const Icon = opt.Icon;
              return (
                <button
                  key={opt.value}
                  id={`status-${opt.value}`}
                  className={`status-option ${status === opt.value ? `selected-${opt.value}` : ""}`}
                  onClick={() => setStatus(opt.value)}
                  type="button"
                >
                  <Icon size={22} strokeWidth={1.8} />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="observations">Observaciones (opcional)</label>
          <textarea
            id="observations"
            className="form-textarea"
            placeholder="Añade notas sobre la visita, anomalías, productos faltantes..."
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
          />
        </div>

        <button
          id="btn-submit-checkin"
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={submitting}
          style={{ marginBottom: "8px" }}
        >
          {submitting ? (
            <><Loader2 size={16} style={{ animation: "spin 0.7s linear infinite" }} /> Guardando...</>
          ) : (
            <><CheckCircle2 size={16} /> Registrar Visita</>
          )}
        </button>

        <p className="text-xs text-muted" style={{ textAlign: "center" }}>
          La visita se guarda localmente y se sincronizará al conectar.
        </p>
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
