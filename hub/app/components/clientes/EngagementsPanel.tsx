"use client";

import { useState } from "react";
import { MessageSquare, Check, Clock, Plus } from "lucide-react";
import type { ContactEngagement } from "@/app/lib/types";
import SectionError from "@/app/components/ui/SectionError";

type ComposerType = "note" | "todo";

interface EngagementsPanelProps {
  engagements: ContactEngagement[] | null; // null = todavía cargando
  error?: string | null;
  onRetry?: () => void;
  onCreate: (type: ComposerType, body: string) => Promise<{ error?: string }>;
  onToggle: (engagement: ContactEngagement) => Promise<{ error?: string }>;
}

export function EngagementsPanel({ engagements, error, onRetry, onCreate, onToggle }: EngagementsPanelProps) {
  const [composerType, setComposerType] = useState<ComposerType>("note");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const items = engagements ?? []; // controlado por el padre

  // El texto solo se limpia si se guardó; si falla, queda escrito para reintentar.
  async function handleAdd() {
    const text = body.trim();
    if (!text || saving) return;
    setSaving(true);
    setSaveError(null);
    const { error: err } = await onCreate(composerType, text);
    setSaving(false);
    if (err) { setSaveError(`No se pudo registrar: ${err}`); return; }
    setBody("");
  }

  async function toggleDone(e: ContactEngagement) {
    setSaveError(null);
    const { error: err } = await onToggle(e);
    if (err) setSaveError(`No se pudo actualizar: ${err}`);
  }

  return (
    <div>
      <div className="section-title" style={{ marginBottom: "6px" }}>Engagements y notas</div>
      <div className="card" style={{ padding: "12px 14px", height: "320px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
          {error ? (
            <SectionError what="las notas" detail={error} onRetry={onRetry} compact />
          ) : engagements === null ? (
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", textAlign: "center", padding: "12px" }}>Cargando…</div>
          ) : items.length === 0 ? (
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", textAlign: "center", padding: "12px" }}>Sin registros. Agregá la primera nota abajo.</div>
          ) : items.map((e) => (
            <div key={e.engagement_id} style={{ display: "flex", gap: "10px", paddingBottom: "10px", borderBottom: "1px solid var(--border)" }}>
              {e.type === "todo" ? (
                <button
                  type="button"
                  onClick={() => toggleDone(e)}
                  aria-label={e.status === "done" ? "Marcar como pendiente" : "Marcar como hecho"}
                  className="todo-check"
                  style={{
                    width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginTop: "1px",
                    cursor: "pointer", padding: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: e.status === "done" ? "1.5px solid var(--success)" : "1.5px solid var(--text-muted)",
                    background: e.status === "done" ? "var(--success)" : "transparent",
                    transition: "border-color var(--duration) var(--ease), background var(--duration) var(--ease)",
                  }}
                >
                  {e.status === "done" && <Check size={11} color="#fff" strokeWidth={3} />}
                </button>
              ) : (
                <div style={{ flexShrink: 0, color: "var(--text-muted)", marginTop: "1px" }}>
                  <MessageSquare size={15} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: "var(--text-sm)", lineHeight: 1.5,
                  color: e.status === "done" ? "var(--text-muted)" : "var(--text-primary)",
                  textDecoration: e.status === "done" ? "line-through" : "none",
                }}>{e.body}</div>
                <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-muted)", marginTop: "3px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "3px" }}><Clock size={10} />{new Date(e.created_at).toLocaleDateString("es-VE", { day: "numeric", month: "short" })}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {saveError && (
          <div role="alert" style={{ fontSize: "var(--text-xs)", color: "var(--danger)" }}>{saveError}</div>
        )}

        {/* Composer */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {/* Selector de tipo (no son pestañas): cada opción anuncia si está elegida con aria-pressed. */}
          <div role="group" aria-label="Tipo de registro" style={{ display: "flex", background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: "2px", flexShrink: 0 }}>
            {(["note", "todo"] as ComposerType[]).map((t) => (
              <button key={t} type="button" aria-pressed={composerType === t} className="focus-ring" onClick={() => setComposerType(t)} style={{
                border: "none", borderRadius: "calc(var(--radius-sm) - 2px)", padding: "6px 10px",
                fontSize: "var(--text-2xs)", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                background: composerType === t ? "var(--accent)" : "transparent",
                color: composerType === t ? "#fff" : "var(--text-muted)",
              }}>{t === "note" ? "Nota" : "To-do"}</button>
            ))}
          </div>
          <input
            className="form-input"
            aria-label={composerType === "note" ? "Nueva nota" : "Nueva tarea"}
            placeholder={composerType === "note" ? "Agregar nota…" : "Agregar tarea…"}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            style={{ padding: "8px 10px", fontSize: "var(--text-sm)" }}
          />
          <button type="button" onClick={handleAdd} disabled={!body.trim() || saving} aria-label={saving ? "Guardando…" : "Agregar"} className="btn btn-primary btn-sm" style={{ width: "auto", flexShrink: 0, padding: "8px 10px" }}>
            {saving ? <span style={{ fontSize: "var(--text-xs)" }}>Guardando…</span> : <Plus size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}
