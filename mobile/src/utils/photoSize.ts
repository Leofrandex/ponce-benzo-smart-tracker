// Lado mayor a `max` px, sin agrandar fotos que ya son chicas.
export function resizeTarget(width: number, height: number, max = 1600): { width: number } | { height: number } | null {
  if (Math.max(width, height) <= max) return null;
  return width >= height ? { width: max } : { height: max };
}
