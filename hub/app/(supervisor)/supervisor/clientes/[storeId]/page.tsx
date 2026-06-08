"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";
import { useSupabaseQuery } from "@/app/lib/hooks/useSupabaseQuery";
import { fetchStoreById, fetchContacts, fetchEngagements } from "@/app/lib/queries/contacts";
import { fetchFullTasks } from "@/app/lib/queries/tasks";
import { ClientInfoPanel } from "@/app/components/clientes/ClientInfoPanel";
import { ContactList } from "@/app/components/clientes/ContactList";
import { EngagementsPanel } from "@/app/components/clientes/EngagementsPanel";
import { ActivityFeed } from "@/app/components/clientes/ActivityFeed";
import { LongTermPlaceholders } from "@/app/components/clientes/LongTermPlaceholders";

export default function ClienteDetailPage() {
  const { storeId } = useParams<{ storeId: string }>();

  const { data: store, loading } = useSupabaseQuery(() => fetchStoreById(storeId), [storeId]);
  const { data: contacts } = useSupabaseQuery(() => fetchContacts(storeId), [storeId]);
  const { data: engagements } = useSupabaseQuery(() => fetchEngagements(storeId), [storeId]);
  const { data: allTasks } = useSupabaseQuery(fetchFullTasks, []);
  const tasks = useMemo(() => (allTasks ?? []).filter((t) => t.store_id === storeId), [allTasks, storeId]);
  const reports: never[] = [];
  const lastRestock = null;

  if (loading) {
    return <div className="empty-state"><div className="empty-title">Cargando…</div></div>;
  }

  if (!store) {
    return (
      <>
        <Link href="/supervisor/clientes" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-muted)", textDecoration: "none", fontWeight: 500 }}><ArrowLeft size={15} /> Clientes</Link>
        <div className="empty-state"><Building2 size={44} style={{ opacity: 0.2 }} /><div className="empty-title">Cliente no encontrado</div></div>
      </>
    );
  }

  return (
    <>
      <Link href="/supervisor/clientes" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-muted)", textDecoration: "none", fontWeight: 500 }}><ArrowLeft size={15} /> Clientes</Link>

      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <div style={{ width: 48, height: 48, borderRadius: "var(--radius-md)", background: "var(--accent-glow)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Building2 size={24} color="var(--accent)" /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.4px", margin: 0 }}>{store.name}</h1>
          <div style={{ marginTop: "4px" }}>
            <span className={store.active ? "badge badge-success" : "badge"} style={!store.active ? { background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)" } : {}}>{store.active ? "Activa" : "Inactiva"}</span>
          </div>
        </div>
      </div>

      <div className="detail-two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <ClientInfoPanel store={store} lastRestock={lastRestock} />
          <ContactList key={storeId} storeId={storeId} contacts={contacts ?? []} />
          <LongTermPlaceholders />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* ActivityFeed expects SupervisorTask[] for tasks; FullTaskRow is incompatible.
              Passing [] for tasks until the write phase reconciles the types (DONE_WITH_CONCERNS). */}
          <ActivityFeed reports={reports} tasks={[]} />
          <EngagementsPanel key={storeId} engagements={engagements ?? []} />
        </div>
      </div>
    </>
  );
}
