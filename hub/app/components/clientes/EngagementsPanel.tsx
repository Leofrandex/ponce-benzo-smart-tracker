"use client";

import { useState } from "react";
import { MessageSquare, Check, Clock, Plus } from "lucide-react";
import type { ContactEngagement } from "@/app/lib/types";

type ComposerType = "note" | "todo";

export function EngagementsPanel({ engagements }: { engagements: ContactEngagement[] }) {
  // Mock-first: estado local sembrado con los engagements existentes.
  const [items, setItems] = useState<ContactEngagement[]>(engagements);
  const [composerType, setComposerType] = useState<ComposerType>("note");
  const [body, setBody] = useState("");

  function handleAdd() {
    const text = body.trim();
    if (!text) return;
    const newItem: ContactEngagement = {
      engagement_id: `eng-${Date.now()}`,
      store_id: items[0]?.store_id ?? "",
      contact_id: null,
      author_user_id: null,
      type: composerType,
      body: text,
      status: composerType === "todo" ? "open" : null,
      due_date: null,
      created_at: new Date().toISOString(),
    };
    setItems((prev) => [newItem, ...prev]);
    setBody("");
  }

  function toggleDone(id: string) {
    setItems((prev) => prev.map((e) =>
      e.engagement_id === id ? { ...e, status: e.status === "done" ? "open" : "done" } : e,
    ));
  }

  return (
    <div>
      <div className="section-title" style={{ marginBottom: "6px" }}>Engagements y notas</div>
      <div className="card" style={{ padding: "12px 14px", height: "320px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
          {items.length === 0 ? (
            <div style={{ fontSize: "13px", color: "var(--text-muted)", textAlign: "center", padding: "12px" }}>Sin registros. Agregá la primera nota abajo.</div>
          ) : items.map((e) => (
            <div key={e.engagement_id} style={{ display: "flex", gap: "10px", paddingBottom: "10px", borderBottom: "1px solid var(--border)" }}>
              {e.type === "todo" ? (
                <button
                  onClick={() => toggleDone(e.engagement_id)}
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
                  fontSize: "13px", lineHeight: 1.5,
                  color: e.status === "done" ? "var(--text-muted)" : "var(--text-primary)",
                  textDecoration: e.status === "done" ? "line-through" : "none",
                }}>{e.body}</div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "3px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "3px" }}><Clock size={10} />{new Date(e.created_at).toLocaleDateString("es-VE", { day: "numeric", month: "short" })}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Composer */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div style={{ display: "flex", background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: "2px", flexShrink: 0 }}>
            {(["note", "todo"] as ComposerType[]).map((t) => (
              <button key={t} onClick={() => setComposerType(t)} style={{
                border: "none", borderRadius: "calc(var(--radius-sm) - 2px)", padding: "6px 10px",
                fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                background: composerType === t ? "var(--accent)" : "transparent",
                color: composerType === t ? "#fff" : "var(--text-muted)",
              }}>{t === "note" ? "Nota" : "To-do"}</button>
            ))}
          </div>
          <input
            className="form-input"
            placeholder={composerType === "note" ? "Agregar nota…" : "Agregar tarea…"}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            style={{ padding: "8px 10px", fontSize: "13px" }}
          />
          <button onClick={handleAdd} disabled={!body.trim()} className="btn btn-primary btn-sm" style={{ width: "auto", flexShrink: 0, padding: "8px 10px" }}>
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
