-- ============================================================
-- Migración 2026-09-28 — versión de la app por jornada (Bloque 7)
--
-- Aplicar en producción con el OK del usuario ANTES de instalar la app 1.3.0
-- (la app envía app_version al subir la jornada; sin la columna, falla).
-- Idempotente. Nullable: las jornadas de apps anteriores quedan en NULL.
-- ============================================================
alter table public.sessions add column if not exists app_version text;
