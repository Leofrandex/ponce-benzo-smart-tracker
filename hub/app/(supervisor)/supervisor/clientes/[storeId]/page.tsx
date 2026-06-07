"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";
import { mockStores, mockReports, mockTasks, mockContacts, mockEngagements, lastRestockForStore } from "@/app/lib/mock-data";
import { ClientInfoPanel } from "@/app/components/clientes/ClientInfoPanel";
import { ContactList } from "@/app/components/clientes/ContactList";
import { EngagementsPanel } from "@/app/components/clientes/EngagementsPanel";
import { ActivityFeed } from "@/app/components/clientes/ActivityFeed";
import { LongTermPlaceholders } from "@/app/components/clientes/LongTermPlaceholders";

export default function ClienteDetailPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const store = useMemo(() => mockStores.find((s) => s.store_id === storeId) ?? null, [storeId]);
  const reports = useMemo(() => mockReports.filter((r) => r.store_id === storeId).sort((a, b) => new Date(b.check_in_time).getTime() - new Date(a.check_in_time).getTime()), [storeId]);
  const tasks = useMemo(() => mockTasks.filter((t) => t.store_id === storeId), [storeId]);
  const contacts = useMemo(() => mockContacts.filter((c) => c.store_id === storeId).sort((a, b) => Number(b.is_primary) - Number(a.is_primary)), [storeId]);
  const engagements = useMemo(() => mockEngagements.filter((e) => e.store_id === storeId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [storeId]);
  const lastRestock = useMemo(() => (storeId ? lastRestockForStore(storeId) : null), [storeId]);

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
          <ContactList key={storeId} storeId={storeId} contacts={contacts} />
          <LongTermPlaceholders />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <ActivityFeed reports={reports} tasks={tasks} />
          <EngagementsPanel key={storeId} engagements={engagements} />
        </div>
      </div>
    </>
  );
}
