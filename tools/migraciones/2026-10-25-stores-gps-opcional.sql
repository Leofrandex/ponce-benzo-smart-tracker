-- ============================================================
-- Migración 2026-10-25 — Sucursales sin GPS
-- El CSV de rutas del 25-oct trae tiendas nuevas sin coordenada y el negocio
-- decidió cargarlas igual. master_lat/master_lng pasan a ser opcionales;
-- null = "GPS pendiente". master_location es columna generada y queda null sola.
-- Hub y móvil ya toleran null (mapa las omite, el check-in no muestra aviso).
-- Idempotente.
-- ============================================================

alter table public.stores alter column master_lat drop not null;
alter table public.stores alter column master_lng drop not null;

-- O las dos o ninguna: una coordenada a medias no sirve para nada.
alter table public.stores drop constraint if exists stores_gps_completo;
alter table public.stores add constraint stores_gps_completo
  check ((master_lat is null) = (master_lng is null));
