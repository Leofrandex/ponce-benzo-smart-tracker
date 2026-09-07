"use client";

import { useState } from "react";
import { CheckCircle2, MessageSquare, Pencil } from "lucide-react";
import { updateTaskNote } from "@/app/lib/mutations/tasks";
import type { FullTaskRow } from "@/app/lib/queries/tasks";

const MAX_NOTA = 1000;

function fechaNota(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("es-VE", { day: "numeric", month: "short" })} · ${d.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}`;
}

/**
 * Comentario de cierre de una tarea. En una tarea abierta acompaña al botón
 * de completar (el texto viaja en el mismo update que el cierre); en una ya
 * completada permite agregarlo o corregirlo después, que es donde vive la
 * trazabilidad real: quién cerró qué y por qué.
 */
export function TaskResolutionNote({
  task,
  onResolve,
  onSaved,
}: {
  task: FullTaskRow;
  onResolve: (nota: string) => Promise<void>;
  onSaved: () => void;
}) {
  const [texto, setTexto] = useState(task.resolution_note ?? "");
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resuelta = task.status === "resolved";

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    const { error: e } = await updateTaskNote(task.task_id, texto);
    setGuardando(false);
    if (e) { setError(e); return; }
    setEditando(false);
    onSaved();
  };

  const completar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await onResolve(texto);
    } finally {
      setGuardando(false);
    }
  };

  const campo = (
    <div className="form-group" style={{ marginBottom: "12px" }}>
      <label className="form-label" style={{ fontSize: "11px" }}>
        Comentario {resuelta ? "" : "(opcional)"}
      </label>
      <textarea
        className="form-textarea"
        style={{ fontSize: "13px", padding: "10px 12px", minHeight: "72px" }}
        placeholder="Qué se hizo, con quién se habló, qué quedó pendiente…"
        maxLength={MAX_NOTA}
        value={texto}
        onChange={(ev) => setTexto(ev.target.value)}
      />
    </div>
  );

  // ── Tarea abierta: comentario + cierre en un solo paso ──
  if (!resuelta) {
    return (
      <>
        {campo}
        {error && <p style={{ fontSize: "12px", color: "var(--danger)", marginBottom: "8px" }}>{error}</p>}
        <button
          className="btn btn-primary"
          style={{ fontSize: "13px", padding: "10px" }}
          disabled={guardando}
          onClick={completar}
        >
          <CheckCircle2 size={14} />
          {guardando ? "Completando…" : "Marcar como completada"}
        </button>
      </>
    );
  }

  // ── Tarea completada, editando el comentario ──
  if (editando) {
    return (
      <>
        {campo}
        {error && <p style={{ fontSize: "12px", color: "var(--danger)", marginBottom: "8px" }}>{error}</p>}
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn btn-primary btn-sm" disabled={guardando} onClick={guardar}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            disabled={guardando}
            onClick={() => { setTexto(task.resolution_note ?? ""); setEditando(false); setError(null); }}
          >
            Cancelar
          </button>
        </div>
      </>
    );
  }

  // ── Tarea completada, comentario en modo lectura ──
  if (!task.resolution_note) {
    return (
      <button className="btn btn-secondary btn-sm" onClick={() => setEditando(true)}>
        <MessageSquare size={13} />
        Agregar comentario
      </button>
    );
  }

  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "12px 14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
        <MessageSquare size={13} color="var(--text-muted)" style={{ marginTop: "3px", flexShrink: 0 }} />
        <p style={{ flex: 1, fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {task.resolution_note}
        </p>
        <button
          className="btn btn-secondary btn-sm"
          style={{ padding: "4px 8px", flexShrink: 0 }}
          onClick={() => setEditando(true)}
          aria-label="Editar comentario"
        >
          <Pencil size={12} />
        </button>
      </div>
      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "8px", paddingLeft: "21px" }}>
        {[task.resolution_note_by_name, task.resolution_note_at ? fechaNota(task.resolution_note_at) : null]
          .filter(Boolean)
          .join(" · ")}
      </div>
    </div>
  );
}
