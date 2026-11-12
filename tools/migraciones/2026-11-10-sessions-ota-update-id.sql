-- 2026-11-10: actualización OTA con la que se abrió cada jornada.
-- app_version no cambia con un OTA, así que no dice si el teléfono tiene la última corrección.
-- La app envía el id de expo-updates, o 'embebido' si corre el código que trae el APK.
-- Va ANTES de publicar la app: sin la columna, el upsert de la jornada falla.
alter table public.sessions add column if not exists ota_update_id text;
