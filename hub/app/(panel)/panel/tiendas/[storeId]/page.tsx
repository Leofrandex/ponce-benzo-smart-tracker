"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2, Pencil, Camera, Megaphone, Package } from "lucide-react";
import { useSupabaseQuery } from "@/app/lib/hooks/useSupabaseQuery";
import { useAuth } from "@/app/lib/auth-context";
import { fetchStoreById, fetchContacts, fetchEngagements } from "@/app/lib/queries/contacts";
import { fetchFullTasks } from "@/app/lib/queries/tasks";
import { tasksForStore } from "@/app/lib/queries/taskFilters";
import { fetchStoreReports, fetchStoreCompetition } from "@/app/lib/queries/reports";
import { fetchStoreRestocks, ultimaReposicion, type RestockRow } from "@/app/lib/queries/restocks";
import { updateStore } from "@/app/lib/mutations/stores";
import { createContact, updateContact, deleteContact } from "@/app/lib/mutations/contacts";
import { createEngagement, toggleEngagementDone } from "@/app/lib/mutations/engagements";
import { eliminarReposicion } from "@/app/lib/mutations/restocks";
import { canRegisterRestock } from "@/app/lib/roles";
import type { Store, ContactEngagement } from "@/app/lib/types";
import type { ContactFormValue } from "@/app/components/clientes/ContactFormModal";
import { ClientInfoPanel } from "@/app/components/clientes/ClientInfoPanel";
import { ContactList } from "@/app/components/clientes/ContactList";
import { EngagementsPanel } from "@/app/components/clientes/EngagementsPanel";
import { ActivityFeed } from "@/app/components/clientes/ActivityFeed";
import { CompetitionReportsPanel } from "@/app/components/clientes/CompetitionReportsPanel";
import { RestocksPanel } from "@/app/components/clientes/RestocksPanel";
import { RestockFormModal } from "@/app/components/clientes/RestockFormModal";
import { LongTermPlaceholders } from "@/app/components/clientes/LongTermPlaceholders";
import { StoreFormModal } from "@/app/components/clientes/StoreFormModal";
import SectionError from "@/app/components/ui/SectionError";
import Segmented from "@/app/components/ui/Segmented";
import { DetailSkeleton } from "@/app/components/ui/Skeleton";

export default function ClienteDetailPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { profile } = useAuth();

  // Cada sección lee su `error`: un fallo de red no se muestra como "vacío".
  const { data: store, loading, error: storeError, refetch: refetchStore } = useSupabaseQuery(() => fetchStoreById(storeId), [storeId], "store");
  const { data: contacts, error: contactsError, refetch: refetchContacts } = useSupabaseQuery(() => fetchContacts(storeId), [storeId], "store:contacts");
  const { data: engagements, error: engagementsError, refetch: refetchEngagements } = useSupabaseQuery(() => fetchEngagements(storeId), [storeId], "store:engagements");
  const { data: allTasks, error: tasksError, refetch: refetchTasks } = useSupabaseQuery(fetchFullTasks, [], "tasks:full");
  const tasks = useMemo(() => tasksForStore(allTasks ?? [], storeId), [allTasks, storeId]);
  const { data: reports, error: reportsError, refetch: refetchReports } = useSupabaseQuery(() => fetchStoreReports(storeId), [storeId], "store:reports");
  const { data: competition, error: competitionError, refetch: refetchCompetition } = useSupabaseQuery(() => fetchStoreCompetition(storeId), [storeId], "store:competition");
  const { data: restocks, loading: loadingRestocks, error: restocksError, refetch: refetchRestocks } = useSupabaseQuery(() => fetchStoreRestocks(storeId), [storeId], "store:restocks");
  const lastRestock = useMemo(() => ultimaReposicion(restocks ?? []), [restocks]);

  const [editOpen, setEditOpen] = useState(false);
  const [restockOpen, setRestockOpen] = useState(false);
  const [activityTab, setActivityTab] = useState<"visitas" | "competencia" | "reposiciones">("visitas");

  // Los handlers de guardado devuelven { error } en vez de hacer alert: el modal/panel lo
  // muestra adentro y conserva lo escrito; solo se cierra si salió bien.
  const onStoreSave = async (updated: Store): Promise<{ error?: string }> => {
    const patch: Partial<Store> = {
      ...updated,
      master_lat: Number(updated.master_lat),
      master_lng: Number(updated.master_lng),
    };
    const { error } = await updateStore(storeId, patch);
    if (error) return { error };
    refetchStore();
    return {};
  };

  const onContactCreate = async (v: ContactFormValue): Promise<{ error?: string }> => {
    const { error } = await createContact(storeId, v);
    if (error) return { error };
    refetchContacts();
    return {};
  };

  const onContactUpdate = async (contactId: string, v: ContactFormValue): Promise<{ error?: string }> => {
    const { error } = await updateContact(storeId, contactId, v);
    if (error) return { error };
    refetchContacts();
    return {};
  };

  const onContactDelete = async (contactId: string): Promise<{ error?: string }> => {
    const { error } = await deleteContact(contactId);
    if (error) return { error };
    refetchContacts();
    return {};
  };

  const onEngagementCreate = async (type: "note" | "todo", body: string): Promise<{ error?: string }> => {
    const { error } = await createEngagement(storeId, type, body);
    if (error) return { error };
    refetchEngagements();
    return {};
  };

  const onEngagementToggle = async (e: ContactEngagement): Promise<{ error?: string }> => {
    const { error } = await toggleEngagementDone(e);
    if (error) return { error };
    refetchEngagements();
    return {};
  };

  const onRestockDelete = async (r: RestockRow) => {
    if (!confirm("¿Eliminar esta reposición? No se puede deshacer.")) return;
    const { error } = await eliminarReposicion(r.restock_id);
    if (error) { alert(error); return; }
    refetchRestocks();
  };

  // Solo la primera carga reemplaza la página: al refrescar tras guardar se mantiene lo visible.
  if (loading && !store) {
    return <DetailSkeleton back="Tiendas" label="Cargando la tienda…" />;
  }

  if (!store) {
    return (
      <>
        <Link href="/panel/tiendas" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "var(--text-sm)", color: "var(--text-muted)", textDecoration: "none", fontWeight: 500 }}><ArrowLeft size={15} /> Tiendas</Link>
        {storeError ? (
          <SectionError what="el cliente" detail={storeError} onRetry={refetchStore} />
        ) : (
          <div className="empty-state"><Building2 size={44} style={{ opacity: 0.2 }} /><div className="empty-title">Cliente no encontrado</div></div>
        )}
      </>
    );
  }

  return (
    <>
      <Link href="/panel/tiendas" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "var(--text-sm)", color: "var(--text-muted)", textDecoration: "none", fontWeight: 500 }}><ArrowLeft size={15} /> Tiendas</Link>

      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <div style={{ width: 48, height: 48, borderRadius: "var(--radius-md)", background: "var(--accent-glow)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Building2 size={24} color="var(--accent)" /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-primary)", letterSpacing: "var(--tracking-tight)", margin: 0 }}>{store.name}</h1>
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
            contacts={contacts}
            error={contactsError}
            onRetry={refetchContacts}
            onCreate={onContactCreate}
            onUpdate={onContactUpdate}
            onDelete={onContactDelete}
          />
          <LongTermPlaceholders />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <Segmented<typeof activityTab>
              ariaLabel="Actividad del cliente"
              value={activityTab}
              onChange={setActivityTab}
              style={{ marginBottom: "8px" }}
              options={[
                { value: "visitas", label: <><Camera size={13} aria-hidden /> Visitas</> },
                {
                  value: "competencia",
                  label: <><Megaphone size={13} aria-hidden /> Competencia{(competition?.length ?? 0) > 0 && <span style={{ fontSize: "var(--text-2xs)", fontWeight: 600, background: "var(--accent-glow)", color: "var(--accent)", borderRadius: "999px", padding: "1px 6px" }}>{competition!.length}</span>}</>,
                },
                {
                  value: "reposiciones",
                  label: <><Package size={13} aria-hidden /> Reposiciones{(restocks?.length ?? 0) > 0 && <span style={{ fontSize: "var(--text-2xs)", fontWeight: 600, background: "var(--accent-glow)", color: "var(--accent)", borderRadius: "999px", padding: "1px 6px" }}>{restocks!.length}</span>}</>,
                },
              ]}
            />
            {activityTab === "visitas" && (
              reportsError || tasksError ? (
                <div className="card" style={{ padding: "4px 16px" }}>
                  <SectionError
                    what={reportsError ? "las visitas" : "las tareas"}
                    detail={reportsError ?? tasksError}
                    onRetry={() => { if (reportsError) refetchReports(); if (tasksError) refetchTasks(); }}
                    compact
                  />
                </div>
              ) : <ActivityFeed reports={reports ?? []} tasks={tasks} />
            )}
            {activityTab === "competencia" && (
              competitionError ? (
                <div className="card" style={{ padding: "4px 16px" }}>
                  <SectionError what="los reportes de competencia" detail={competitionError} onRetry={refetchCompetition} compact />
                </div>
              ) : <CompetitionReportsPanel reports={competition ?? []} />
            )}
            {activityTab === "reposiciones" && (restocksError ? (
              <div className="card" style={{ padding: "4px 16px" }}>
                <SectionError what="las reposiciones" detail={restocksError} onRetry={refetchRestocks} compact />
              </div>
            ) : (
              <RestocksPanel
                rows={restocks ?? []}
                loading={loadingRestocks && !restocks}
                canRegister={canRegisterRestock(profile?.role)}
                currentUserId={profile?.id ?? null}
                isAdmin={profile?.role === "admin"}
                onRegister={() => setRestockOpen(true)}
                onDelete={onRestockDelete}
              />
            ))}
          </div>
          <EngagementsPanel
            key={storeId}
            engagements={engagements}
            error={engagementsError}
            onRetry={refetchEngagements}
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
      <RestockFormModal
        open={restockOpen}
        storeId={storeId}
        onClose={() => setRestockOpen(false)}
        onSaved={() => { setRestockOpen(false); refetchRestocks(); }}
      />
    </>
  );
}
