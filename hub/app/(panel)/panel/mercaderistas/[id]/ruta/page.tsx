"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/app/lib/auth-context";
import { canConfigure } from "@/app/lib/roles";
import { useSupabaseQuery } from "@/app/lib/hooks/useSupabaseQuery";
import { fetchUserName } from "@/app/lib/queries/merchandisers";
import { fetchTiendasBuscables, fetchVersiones } from "@/app/lib/queries/rutaPlan";
import { sumarDias } from "@/app/lib/queries/rutas";
import { hoyCaracas } from "@/app/lib/queries/taskFilters";
import EditorRuta from "@/app/components/mercaderistas/editor/EditorRuta";
import SectionError from "@/app/components/ui/SectionError";
import { DetailSkeleton, Skeleton, SkeletonCard, SkeletonScreen } from "@/app/components/ui/Skeleton";

// Solo admins. Las consultas viven en el hijo: si no es admin, no se dispara ninguna.
export default function EditarRutaPage() {
  const { id } = useParams<{ id: string }>();
  const { profile, loading } = useAuth();
  const router = useRouter();
  const allowed = canConfigure(profile?.role);

  useEffect(() => {
    if (!loading && !allowed) router.replace(`/panel/mercaderistas/${id}`);
  }, [loading, allowed, router, id]);

  if (loading || !allowed) return <DetailSkeleton back="Mercaderista" label="Cargando el editor de ruta…" />;
  return <Cargador id={id} />;
}

function Cargador({ id }: { id: string }) {
  // Sin key de caché: el editor necesita las versiones frescas (el guardado compara la última vista).
  const qVersiones = useSupabaseQuery(() => fetchVersiones(id), [id]);
  const qTiendas = useSupabaseQuery(fetchTiendasBuscables, []);
  const { data: nombre } = useSupabaseQuery(() => fetchUserName(id), [id], "merch:name");
  const [manana] = useState(() => sumarDias(hoyCaracas(), 1));

  const error = qVersiones.error ?? qTiendas.error;
  if (error) {
    return <SectionError what="la ruta" detail={error} onRetry={() => { qVersiones.refetch(); qTiendas.refetch(); }} />;
  }
  if (!qVersiones.data || !qTiendas.data) {
    return (
      <SkeletonScreen label="Cargando la ruta…">
        <Skeleton h={10} w={120} pill />
        <SkeletonCard>
          <Skeleton h={14} w={240} pill />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10 }}>
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={420} style={{ borderRadius: "var(--radius-sm)" }} />)}
          </div>
        </SkeletonCard>
      </SkeletonScreen>
    );
  }
  return <EditorRuta userId={id} nombre={nombre ?? "Mercaderista"} versiones={qVersiones.data} tiendas={qTiendas.data} manana={manana} />;
}
