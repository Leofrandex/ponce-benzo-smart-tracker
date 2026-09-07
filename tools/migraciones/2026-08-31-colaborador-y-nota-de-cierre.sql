-- ============================================================
-- Migración 2026-08-31 — rol `colaborador` + nota de cierre en tareas
--
-- Aplicar en el SQL editor de Supabase (producción).
--
-- Bloque 1 — Nota de cierre opcional en `tasks`.
-- Bloque 2 — Nuevo rol `colaborador`: cuenta maestra compartida con la que
--            la dirección registra recorridos desde la app móvil.
--
-- NO BORRA DATOS. No hay DROP TABLE / DROP COLUMN / DELETE / TRUNCATE.
-- Supabase marca el script como "destructivo" por la palabra DROP del
-- `DROP CONSTRAINT`, que es la única forma de reemplazar un CHECK en
-- Postgres. Va dentro de una transacción: o entra todo, o no entra nada.
--
-- Idempotente: se puede re-ejecutar sin efectos secundarios.
-- Refleja los cambios ya volcados en tools/supabase_schema.sql (SSOT).
--
-- Nota: si el editor de Supabase avisa "there is already a transaction in
-- progress" al leer el BEGIN, es un WARNING inofensivo — ya envuelve el
-- script en una transacción, que es justo lo que buscamos.
-- ============================================================

BEGIN;

-- ── 1. tasks: nota de cierre ────────────────────────────────
-- Puramente aditivo: tres columnas anulables. El hub que está publicado
-- ahora mismo no las consulta, así que puede correrse con el sitio en vivo.
-- Se separan de resolved_at/resolved_by porque la nota es editable después
-- del cierre y puede escribirla alguien distinto de quien resolvió.
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS resolution_note    TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS resolution_note_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS resolution_note_at TIMESTAMPTZ;

COMMENT ON COLUMN public.tasks.resolution_note IS
  'Comentario opcional del vendedor al completar la tarea. Editable después del cierre.';

-- ── 2. Rol colaborador ──────────────────────────────────────

-- 2a. CHECK de users.role.
-- No se asume el nombre de la restricción: se eliminan TODAS las CHECK de
-- `users` que mencionen `role`. Un `DROP CONSTRAINT IF EXISTS <nombre fijo>`
-- no falla si el nombre no coincide — simplemente no borra nada, y quedarían
-- dos CHECK, con la vieja rechazando 'colaborador' en silencio.
DO $migracion$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND contype  = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', r.conname);
    RAISE NOTICE 'CHECK eliminada para recrearla: %', r.conname;
  END LOOP;
END;
$migracion$;

-- Si alguna fila tuviera un rol fuera de la lista, este ADD falla y la
-- transacción entera se revierte (la restricción vieja vuelve intacta).
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('merchandiser', 'vendedor', 'admin', 'colaborador'));

-- 2b. Helper de rol. CREATE OR REPLACE: no hay momento sin la función.
-- El colaborador es personal de campo sin ruta asignada: necesita el catálogo
-- completo de sucursales para el "reporte suelto", igual que el mercaderista,
-- pero NO hereda la visibilidad global del admin sobre visitas/tareas/fotos.
CREATE OR REPLACE FUNCTION public.fn_is_colaborador()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'colaborador' AND active
  );
$$;
REVOKE EXECUTE ON FUNCTION public.fn_is_colaborador() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_is_colaborador() TO authenticated;

-- 2c. Políticas de lectura de catálogo.
-- ALTER POLICY en vez de DROP + CREATE: reemplaza la expresión in situ, sin
-- ninguna ventana en la que la tabla quede sin política (con RLS activo, esa
-- ventana significa que NADIE ve nada). Falla ruidosamente si la política no
-- existe con ese nombre, en vez de dejar la tabla descubierta.
ALTER POLICY "stores_read" ON public.stores
  USING (
    public.fn_is_admin()
    OR public.fn_is_merchandiser()
    OR public.fn_is_colaborador()
    OR client_id IN (SELECT public.fn_my_client_ids())
  );

ALTER POLICY "clients_select" ON public.clients
  USING (
    public.fn_is_admin()
    OR public.fn_is_merchandiser()
    OR public.fn_is_colaborador()
    OR client_id IN (SELECT public.fn_my_client_ids())
  );

COMMIT;

-- ── Verificación (solo lectura) ─────────────────────────────
SELECT
  (SELECT pg_get_constraintdef(oid) FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass AND conname = 'users_role_check') AS check_de_role,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks'
      AND column_name IN ('resolution_note','resolution_note_by','resolution_note_at')) AS columnas_de_nota,
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public' AND policyname IN ('stores_read','clients_select')
      AND qual ILIKE '%fn_is_colaborador%') AS politicas_actualizadas;
