"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/lib/auth-context";
import { canConfigure } from "@/app/lib/roles";
import { ConfigSkeleton } from "@/app/components/ui/Skeleton";

const TABS = [
  { href: "/panel/configuracion/vendedores", label: "Vendedores por cadena" },
  { href: "/panel/configuracion/productos",  label: "Productos" },
];

export default function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const allowed = canConfigure(profile?.role);

  useEffect(() => {
    if (!loading && !allowed) router.replace("/panel");
  }, [loading, allowed, router]);

  // Mientras carga el perfil, o si no es admin, no se monta la página hija:
  // así tampoco dispara consultas.
  if (loading || !allowed) {
    return <ConfigSkeleton />;
  }

  return (
    <>
      <div>
        <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 600, letterSpacing: "var(--tracking-tight)" }}>Configuración</h1>
        <p className="text-muted text-sm" style={{ marginTop: "4px" }}>Qué cadenas atiende cada vendedor y cómo se agrupa el catálogo</p>
      </div>
      {/* Pestañas = navegación (subrayado); los filter-chip quedan para filtrar dentro de cada pestaña. */}
      <nav aria-label="Secciones de configuración" style={{ display: "flex", gap: "20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        {TABS.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className="cfg-tab" style={{
              padding: "8px 0", marginBottom: "-1px", fontSize: "var(--text-base)", fontWeight: active ? 700 : 500,
              color: active ? "var(--text-primary)" : "var(--text-secondary)",
              borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
            }}>
              {t.label}
            </Link>
          );
        })}
      </nav>
      {children}
      {/* Tabla compartida por las pestañas: header fijo, hairline entre filas, hover que ilumina la fila. */}
      <style>{`
        .cfg-tab:hover { color: var(--text-primary) !important; }
        .cfg-table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
        .cfg-table th { position: sticky; top: 0; z-index: 1; background: var(--bg-card); box-shadow: inset 0 -1px 0 var(--border);
          padding: 10px 14px; text-align: left; color: var(--text-muted); font-size: var(--text-2xs); font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; white-space: nowrap; }
        .cfg-table td { padding: 10px 14px; vertical-align: middle; }
        .cfg-table tbody tr + tr { border-top: 1px solid var(--border); }
        .cfg-table tbody tr:hover { background: var(--bg-base); }
        .cfg-num { text-align: right !important; font-variant-numeric: tabular-nums; }
        .cfg-inline-input { width: 100%; min-width: 160px; padding: 6px 10px; font-family: inherit; font-size: var(--text-sm); color: var(--text-primary);
          background: transparent; border: 1px solid transparent; border-radius: var(--radius-sm); transition: border-color var(--duration) var(--ease); }
        .cfg-table tr:hover .cfg-inline-input, .cfg-inline-input:focus { border-color: var(--border); background: var(--bg-surface); }
        .cfg-inline-input:focus { border-color: var(--accent); }
        .cfg-inline-input:disabled { opacity: 0.5; }
      `}</style>
    </>
  );
}
