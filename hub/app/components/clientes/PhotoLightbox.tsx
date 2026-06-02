"use client";

import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

export function PhotoLightbox({ urls, startIndex, onClose }: { urls: string[]; startIndex: number; onClose: () => void }) {
  const [i, setI] = useState(startIndex);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((p) => (p + 1) % urls.length);
      if (e.key === "ArrowLeft") setI((p) => (p - 1 + urls.length) % urls.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [urls.length, onClose]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "transparent", border: "none", cursor: "pointer", color: "white" }}><X size={28} /></button>
      {urls.length > 1 && (
        <button onClick={(e) => { e.stopPropagation(); setI((p) => (p - 1 + urls.length) % urls.length); }} style={{ position: "absolute", left: 16, background: "transparent", border: "none", cursor: "pointer", color: "white" }}><ChevronLeft size={36} /></button>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={urls[i]} alt={`Foto ${i + 1}`} onClick={(e) => e.stopPropagation()} style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: "8px", objectFit: "contain" }} />
      {urls.length > 1 && (
        <button onClick={(e) => { e.stopPropagation(); setI((p) => (p + 1) % urls.length); }} style={{ position: "absolute", right: 16, background: "transparent", border: "none", cursor: "pointer", color: "white" }}><ChevronRight size={36} /></button>
      )}
      <div style={{ position: "absolute", bottom: 20, color: "white", fontSize: "13px" }}>{i + 1} / {urls.length}</div>
    </div>
  );
}
