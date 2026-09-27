-- ============================================================
-- Migración 2026-09-26 — línea comercial de producto
--
-- Aplicar en el SQL editor de Supabase (producción).
--
-- Contexto: Diego quiere filtrar tareas y ver quiebres por "línea". Los
-- productos solo tienen `brand`. La línea la define P&B y se edita desde
-- Configuración (Bloque 3). NULL = "Sin línea".
-- La política products_write_admin (ALL, fn_is_admin()) ya cubre su edición.
-- ============================================================

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS line TEXT;
COMMENT ON COLUMN public.products.line IS
  'Línea comercial definida por P&B desde Configuración. NULL = sin línea.';
