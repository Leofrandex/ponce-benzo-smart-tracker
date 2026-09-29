import { PanelSkeleton } from "@/app/components/ui/Skeleton";

// Respaldo genérico mientras llega una sección que aún no se había precargado.
// Cada sección tiene su propio loading.tsx con la forma exacta de su contenido.
export default function Loading() {
  return <PanelSkeleton />;
}
