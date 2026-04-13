"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, LayoutDashboard, ClipboardList, Map, Building2 } from "lucide-react";
import PageTransition from "@/app/components/PageTransition";

export default function SupervisorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { href: "/supervisor",           icon: LayoutDashboard, label: "Panel"     },
    { href: "/supervisor/contactos", icon: Building2,       label: "Contactos" },
    { href: "/supervisor/tareas",    icon: ClipboardList,   label: "Tareas"    },
    { href: "/supervisor/mapa",      icon: Map,             label: "Mapa"      },
  ];

  const dateStr = new Date().toLocaleDateString("es-VE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <div className="app-shell">
      {/* ── SIDEBAR (desktop only) ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Image src="/pb_logo.png" alt="Ponce & Benzo" width={120} height={60} style={{ objectFit: "contain" }} />
        </div>

        <div className="sidebar-section-label">Supervisor</div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/supervisor"
                ? pathname === "/supervisor"
                : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-nav-item ${active ? "active" : ""}`}
              >
                <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-date">{dateStr}</div>
          <button
            className="sidebar-nav-item"
            style={{ width: "100%", border: "none", cursor: "pointer", background: "transparent" }}
            onClick={() => router.push("/select")}
          >
            <LogOut size={18} strokeWidth={1.8} />
            Cambiar hub
          </button>
        </div>
      </aside>

      {/* ── MAIN WRAPPER ── */}
      <div className="main-wrapper">
        <header className="header">
          <div className="header-logo">
            <Image src="/pb_logo.png" alt="Ponce & Benzo" width={90} height={44} style={{ objectFit: "contain" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>
              {dateStr}
            </span>
            <button
              onClick={() => router.push("/select")}
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "6px 12px",
                fontSize: "12px",
                color: "var(--text-secondary)",
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: 500,
              }}
            >
              Cambiar hub
            </button>
          </div>
        </header>

        {/* Page Content with transition */}
        <PageTransition>
          <main className="main-content">{children}</main>
        </PageTransition>

        {/* Bottom Navigation (mobile only) */}
        <nav className="bottom-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/supervisor"
                ? pathname === "/supervisor"
                : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${active ? "active" : ""}`}
              >
                <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
