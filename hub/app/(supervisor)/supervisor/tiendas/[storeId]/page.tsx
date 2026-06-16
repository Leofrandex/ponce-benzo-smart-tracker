"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2, Pencil } from "lucide-react";
import { useSupabaseQuery } from "@/app/lib/hooks/useSupabaseQuery";
import { fetchStoreById, fetchContacts, fetchEngagements } from "@/app/lib/queries/contacts";
import { fetchFullTasks } from "@/app/lib/queries/tasks";
import { updateStore } from "@/app/lib/mutations/stores";
import { createContact, updateContact, deleteContact } from "@/app/lib/mutations/contacts";
import { createEngagement, toggleEngagementDone } from "@/app/lib/mutations/engagements";
import type { Store, ContactEngagement } from "@/app/lib/types";
import type { ContactFormValue } from "@/app/components/clientes/ContactFormModal";
import { ClientInfoPanel } from "@/app/components/clientes/ClientInfoPanel";
import { ContactList } from "@/app/components/clientes/ContactList";
import { EngagementsPanel } from "@/app/components/clientes/EngagementsPanel";
import { ActivityFeed } from "@/app/components/clientes/ActivityFeed";
import { LongTermPlaceholders } from "@/app/components/clientes/LongTermPlaceholders";
import { StoreFormModal } from "@/app/components/clientes/StoreFormModal";

export default function ClienteDetailPage() {
  const { storeId } = useParams<{ storeId: string }>();

  const { data: store, loading, refetch: refetchStore } = useSupabaseQuery(() => fetchStoreById(storeId), [storeId]);
  const { data: contacts, refetch: refetchContacts } = useSupabaseQuery(() => fetchContacts(storeId), [storeId]);
  const { data: engagements, refetch: refetchEngagements } = useSupabaseQuery(() => fetchEngagements(storeId), [storeId]);
  const { data: allTasks } = useSupabaseQuery(fetchFullTasks, []);
  const tasks = useMemo(() => (allTasks ?? []).filter((t) => t.store_id === storeId), [allTasks, storeId]);
  const reports: never[] = [];
  const lastRestock = null;

  const [editOpen, setEditOpen] = useState(false);

  const onStoreSave = async (updated: Store) => {
    const patch: Partial<Store> = {
      ...updated,
      master_lat: Number(updated.master_lat),
      master_lng: Number(updated.master_lng),
    };
    const { error } = await updateStore(storeId, patch);
    if (error) { alert("No se pudo guardar la sucursal: " + error); return; }
    setEditOpen(false);
    refetchStore();
  };

  const onContactCreate = async (v: ContactFormValue) => {
    const { error } = await createContact(storeId, v);
    if (error) { alert("No se pudo crear el contacto: " + error); return; }
    refetchContacts();
  };

  const onContactUpdate = async (contactId: string, v: ContactFormValue) => {
    const { error } = await updateContact(storeId, contactId, v);
    if (error) { alert("No se pudo actualizar el contacto: " + error); return; }
    refetchContacts();
  };

  const onContactDelete = async (contactId: string) => {
    const { error } = await deleteContact(contactId);
    if (error) { alert("No se pudo eliminar el contacto: " + error); return; }
    refetchContacts();
  };

  const onEngagementCreate = async (type: "note" | "todo", body: string) => {
    const { error } = await createEngagement(storeId, type, body);
    if (error) { alert("No se pudo registrar: " + error); return; }
    refetchEngagements();
  };

  const onEngagementToggle = async (e: ContactEngagement) => {
    const { error } = await toggleEngagementDone(e);
    if (error) { alert("No se pudo actualizar: " + error); return; }
    refetchEngagements();
  };

  if (loading) {
    return <div className="empty-state"><div className="empty-title">Cargando…</div></div>;
  }

  if (!store) {
    return (
      <>
        <Link href="/supervisor/tiendas" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-muted)", textDecoration: "none", fontWeight: 500 }}><ArrowLeft size={15} /> Tiendas</Link>
        <div className="empty-state"><Building2 size={44} style={{ opacity: 0.2 }} /><div className="empty-title">Cliente no encontrado</div></div>
      </>
    );
  }

  return (
    <>
      <Link href="/supervisor/tiendas" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-muted)", textDecoration: "none", fontWeight: 500 }}><ArrowLeft size={15} /> Tiendas</Link>

      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <div style={{ width: 48, height: 48, borderRadius: "var(--radius-md)", background: "var(--accent-glow)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Building2 size={24} color="var(--accent)" /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.4px", margin: 0 }}>{store.name}</h1>
          <div style={{ marginTop: "4px" }}>
            <span className={store.active ? "badge badge-success" : "badge"} style={!store.active ? { background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)" } : {}}>{store.active ? "Activa" : "Inactiva"}</span>
          </div>
        </div>
        <button type="button" onClick={() => setEditOpen(true)} className="filter-chip" style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
          <Pencil size={12} /> Editar
        </button>
      </div>

      <div className="detail-two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <ClientInfoPanel store={store} lastRestock={lastRestock} />
          <ContactList
            key={storeId}
            storeId={storeId}
            contacts={contacts ?? []}
            onCreate={onContactCreate}
            onUpdate={onContactUpdate}
            onDelete={onContactDelete}
          />
          <LongTermPlaceholders />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <ActivityFeed reports={reports} tasks={[]} />
          <EngagementsPanel
            key={storeId}
            engagements={engagements ?? []}
            onCreate={onEngagementCreate}
            onToggle={onEngagementToggle}
          />
        </div>
      </div>

      <StoreFormModal
        open={editOpen}
        store={store}
        onClose={() => setEditOpen(false)}
        onSave={onStoreSave}
      />
    </>
  );
}
