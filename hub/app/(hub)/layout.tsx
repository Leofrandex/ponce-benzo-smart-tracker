"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Route, ClipboardList, User } from "lucide-react";

export default function HubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { href: "/ruta",      icon: Route,         label: "Mi Ruta"   },
    { href: "/historial", icon: ClipboardList,  label: "Historial" },
    { href: "/perfil",    icon: User,           label: "Perfil"    },
  ];

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="header">
        <div className="header-logo">
          <div className="logo-dot" />
          <span className="header-title">PV Tracker</span>
        </div>
        <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>
          {new Date().toLocaleDateString("es-VE", {
            weekday: "short",
            day: "numeric",
            month: "short",
          })}
        </span>
      </header>

      {/* Page Content */}
      <main className="main-content">{children}</main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              id={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
              className={`nav-item ${active ? "active" : ""}`}
            >
              <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
