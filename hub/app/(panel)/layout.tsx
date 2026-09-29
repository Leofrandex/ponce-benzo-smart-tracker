"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, LayoutDashboard, ClipboardList, Map, Building2, Store, Settings, Users, MoreHorizontal } from "lucide-react";
import PageTransition from "@/app/components/PageTransition";
import { useAuth } from "@/app/lib/auth-context";
import { canConfigure, roleLabel } from "@/app/lib/roles";

// En la barra inferior (< 1024px) solo caben 4 secciones fijas + "Más".
const BOTTOM_PRIMARY = ["/panel", "/panel/tareas", "/panel/tiendas", "/panel/mapa"];
const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

// Bottom sheet del menú "Más": overlay, Esc / tap fuera cierran, el foco entra
// al abrir, queda atrapado adentro y vuelve al disparador al cerrar.
function MoreSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    (el?.querySelector<HTMLElement>(FOCUSABLE) ?? el)?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onCloseRef.current(); return; }
      if (e.key !== "Tab" || !el) return;
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus(); };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <>
      <div className="sheet-overlay" onClick={onClose} aria-hidden="true" />
      <div ref={ref} className="sheet" role="dialog" aria-modal="true" aria-labelledby="more-sheet-title" tabIndex={-1}>
        <div className="sheet-grip" />
        <div id="more-sheet-title" className="sheet-title">Más secciones</div>
        {children}
      </div>
    </>,
    document.body,
  );
}

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, profile } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  // Navegar cierra el sheet.
  useEffect(() => { setMoreOpen(false); }, [pathname]);

  function handleLogout() {
    signOut();
    router.push("/");
  }

  const navItems = [
    { href: "/panel",          icon: LayoutDashboard, label: "Panel"    },
    { href: "/panel/clientes", icon: Building2,       label: "Clientes" },
    { href: "/panel/tiendas",  icon: Store,           label: "Tiendas"  },
    { href: "/panel/tareas",   icon: ClipboardList,   label: "Tareas"   },
    { href: "/panel/mercaderistas", icon: Users,      label: "Mercaderistas" },
    { href: "/panel/mapa",     icon: Map,             label: "Mapa"     },
    ...(canConfigure(profile?.role)
      ? [{ href: "/panel/configuracion", icon: Settings, label: "Configuración" }]
      : []),
  ];

  const isActive = (href: string) =>
    href === "/panel" ? pathname === "/panel" : pathname === href || pathname.startsWith(href + "/");
  const bottomItems = BOTTOM_PRIMARY
    .map((href) => navItems.find((i) => i.href === href))
    .filter((i): i is (typeof navItems)[number] => !!i);
  const moreItems = navItems.filter((i) => !BOTTOM_PRIMARY.includes(i.href));
  const moreActive = moreItems.some((i) => isActive(i.href));

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

        <div className="sidebar-section-label">{roleLabel(profile?.role ?? "")}</div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/panel"
                ? pathname === "/panel"
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
            onClick={handleLogout}
          >
            <LogOut size={18} strokeWidth={1.8} />
            Cerrar sesión
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
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 500 }}>
              {dateStr}
            </span>
            <button
              onClick={handleLogout}
              aria-label="Cerrar sesión"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "6px 12px",
                fontSize: "var(--text-xs)",
                color: "var(--text-secondary)",
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <LogOut size={13} />
              Salir
            </button>
          </div>
        </header>

        {/* Page Content with transition */}
        <PageTransition>
          <main className="main-content">{children}</main>
        </PageTransition>

        {/* Bottom Navigation (mobile only) */}
        <nav className="bottom-nav" aria-label="Secciones">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
                <span className="nav-label">{item.label}</span>
              </Link>
            );
          })}
          {moreItems.length > 0 && (
            <button
              type="button"
              className={`nav-item ${moreActive ? "active" : ""}`}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen(true)}
              style={{ fontFamily: "inherit" }}
            >
              <MoreHorizontal size={22} strokeWidth={moreActive ? 2.2 : 1.8} />
              <span className="nav-label">Más</span>
            </button>
          )}
        </nav>

        <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)}>
          <nav aria-label="Más secciones">
            {moreItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sheet-link ${active ? "active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMoreOpen(false)}
                >
                  <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </MoreSheet>
      </div>
    </div>
  );
}
