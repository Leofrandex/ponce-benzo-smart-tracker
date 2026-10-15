"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSupabaseQuery } from "@/app/lib/hooks/useSupabaseQuery";
import { fetchNearbyStores, fetchClientOptions } from "@/app/lib/queries/storeProposals";
import { approveProposal, rejectProposal } from "@/app/lib/mutations/storeProposals";
import { draftFromProposal, type Proposal, type StoreDraft } from "@/app/lib/storeProposals";

const ProposalMap = dynamic(() => import("./ProposalMap"), { ssr: false, loading: () => <div className="skeleton" style={{ height: 280 }} /> });

const CANALES = ["farmacia", "drogueria", "supermercado", "autoservicio", "mayorista", "otro"];
const TEXT_FIELDS: Array<[keyof StoreDraft, string]> = [
  ["address", "Dirección"], ["estado", "Estado"], ["municipio", "Municipio"],
  ["urbanizacion", "Urbanización"], ["ciudad", "Ciudad"], ["region", "Región"],
];

export default function ProposalReview({ proposal, onDone }: { proposal: Proposal; onDone: (result: { kind: "aprobada"; storeId: string | null } | { kind: "rechazada" }) => void }) {
  const [draft, setDraft] = useState<StoreDraft>(() => draftFromProposal(proposal));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string } | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const qNear = useSupabaseQuery(() => fetchNearbyStores(proposal.lat, proposal.lng), [proposal.proposal_id], "prop:near");
  const qClients = useSupabaseQuery(fetchClientOptions, [], "prop:clients");
  const set = (k: keyof StoreDraft, v: string | number) => setDraft((d) => ({ ...d, [k]: v }));

  const points = useMemo(() => [
    { id: proposal.proposal_id, lat: draft.master_lat, lng: draft.master_lng, label: draft.name || proposal.name, kind: "propuesta" as const },
    ...(qNear.data ?? []).map((s) => ({ id: s.store_id, lat: s.master_lat, lng: s.master_lng, label: s.name, kind: "existente" as const })),
  ], [proposal, draft.master_lat, draft.master_lng, draft.name, qNear.data]);

  async function aprobar() {
    setBusy(true); setMsg(null);
    const { storeId, error } = await approveProposal(proposal.proposal_id, draft);
    setBusy(false);
    if (error) { setMsg({ text: error }); return; }
    onDone({ kind: "aprobada", storeId });
  }

  async function rechazar(duplicateOf: string | null, fixGps: { lat: number; lng: number } | null, motivo: string) {
    setBusy(true); setMsg(null);
    const { error } = await rejectProposal(proposal.proposal_id, motivo, duplicateOf, fixGps);
    setBusy(false);
    if (error) { setMsg({ text: error }); return; }
    onDone({ kind: "rechazada" });
  }

  return (
    <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600 }}>{proposal.name}</h2>
        <p className="text-muted text-sm">
          Registrada por {proposal.author_name} · {new Date(proposal.captured_at).toLocaleString("es-VE")}
          {proposal.accuracy_m != null && ` · ±${Math.round(proposal.accuracy_m)} m`}
          {proposal.client_name && ` · sugiere ${proposal.client_name}`}
        </p>
        {proposal.note && <p className="text-sm" style={{ marginTop: 6 }}>“{proposal.note}”</p>}
      </div>

      {proposal.photo_signed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={proposal.photo_signed} alt={`Fachada de ${proposal.name}`} style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: "var(--radius-md)" }} />
      )}

      <div style={{ height: 280 }}>
        <ProposalMap points={points} selectedId={proposal.proposal_id} draggable
          onMove={(lat, lng) => setDraft((d) => ({ ...d, master_lat: lat, master_lng: lng }))} />
      </div>
      <p className="text-muted text-xs">Arrastra el punto naranja si el GPS quedó corrido. Gris: sucursales que ya existen a menos de 100 m.</p>

      {(qNear.data ?? []).length > 0 && (
        <div className="card" style={{ padding: 12, borderColor: "var(--warning, #d97706)" }}>
          <strong className="text-sm">Hay sucursales a menos de 100 m. ¿Es alguna de estas?</strong>
          {(qNear.data ?? []).map((s) => (
            <div key={s.store_id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
              <span className="text-sm" style={{ flex: 1 }}>{s.name} · {Math.round(s.distancia_m)} m</span>
              <button className="btn btn-secondary" disabled={busy} onClick={() => { if (window.confirm(`¿Rechazar como duplicada de "${s.name}"?`)) rechazar(s.store_id, null, `Duplicada: es ${s.name}`); }}>Es esta, rechazar</button>
              <button className="btn btn-secondary" disabled={busy} onClick={() => { if (window.confirm(`¿Rechazar como duplicada y mover la ubicación de "${s.name}" a este punto? Esto cambia la sucursal existente.`)) rechazar(s.store_id, { lat: draft.master_lat, lng: draft.master_lng }, `Duplicada: es ${s.name} (GPS corregido)`); }}>Es esta y usar este GPS</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <label className="form-group"><span className="form-label">Nombre *</span>
          <input className="form-input" value={draft.name} onChange={(e) => set("name", e.target.value)} /></label>
        {TEXT_FIELDS.map(([k, label]) => (
          <label key={k} className="form-group"><span className="form-label">{label}</span>
            <input className="form-input" value={draft[k] as string} onChange={(e) => set(k, e.target.value)} /></label>
        ))}
        <label className="form-group"><span className="form-label">Cadena / cliente</span>
          <select className="form-input" value={draft.client_id} onChange={(e) => set("client_id", e.target.value)}>
            <option value="">Sin cadena</option>
            {(qClients.data ?? []).map((c) => <option key={c.client_id} value={c.client_id}>{c.name}</option>)}
          </select></label>
        <label className="form-group"><span className="form-label">Canal</span>
          <select className="form-input" value={draft.business_channel} onChange={(e) => set("business_channel", e.target.value)}>
            <option value="">—</option>
            {CANALES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></label>
        <label className="form-group"><span className="form-label">Clasificación</span>
          <select className="form-input" value={draft.classification} onChange={(e) => set("classification", e.target.value)}>
            <option value="">—</option><option>A</option><option>B</option><option>C</option>
          </select></label>
      </div>
      <p className="text-muted text-xs">GPS: {draft.master_lat.toFixed(6)}, {draft.master_lng.toFixed(6)}</p>

      {msg && (
        <p role="alert" className="text-sm" style={{ color: "#f43f5e" }}>{msg.text}</p>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-primary" disabled={busy} onClick={aprobar}>Crear sucursal</button>
        {!rejecting ? (
          <button className="btn btn-secondary" disabled={busy} onClick={() => setRejecting(true)}>Rechazar</button>
        ) : (
          <>
            <input className="form-input" style={{ flex: 1, minWidth: 200 }} placeholder="Motivo del rechazo" value={reason} onChange={(e) => setReason(e.target.value)} />
            <button className="btn btn-secondary" disabled={busy || !reason.trim()} onClick={() => rechazar(null, null, reason)}>Confirmar rechazo</button>
          </>
        )}
      </div>
    </div>
  );
}
