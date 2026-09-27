"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/lib/auth-context";
import { canConfigure } from "@/app/lib/roles";

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
    return <div className="empty-state"><div className="empty-title">Cargando…</div></div>;
  }

  return (
    <>
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px" }}>Configuración</h1>
        <p className="text-muted text-sm" style={{ marginTop: "4px" }}>Solo administradores</p>
      </div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className={`filter-chip ${pathname.startsWith(t.href) ? "active" : ""}`}>
            {t.label}
          </Link>
        ))}
      </div>
      {children}
    </>
  );
}
