-- ============================================================
-- Migración 2026-09-26 — fotos de visitas: reintento y recuperación
--
-- Aplicar en el SQL editor de Supabase (producción).
--
-- Contexto: el motor de sync móvil (desde el 15-jul) sube la visita con
-- photo_urls=[] y después sube las fotos una a una (15 s de plazo por foto)
-- con `upload(..., { upsert: true })`, y al final hace UPDATE de photo_urls.
-- Si una foto se corta por mala señal, el reintento vuelve a subir desde la
-- foto 0, que YA existe: un upsert sobre un objeto existente exige permiso de
-- UPDATE en storage.objects, y el bucket `visit-photos` solo tenía INSERT y
-- SELECT. El reintento fallaba para siempre y la visita quedaba sin fotos
-- (~42 % de las visitas desde julio; 632 con fotos huérfanas en Storage).
--
-- Bloque 1 — política UPDATE sobre la carpeta propia: destraba los reintentos.
-- Bloque 2 — enlaza a cada visita sin photo_urls las fotos que ya están en
--            Storage (`<user_id>/<visit_id>/<n>.jpg`, ordenadas por n).
--            Respaldo de las visitas vacías antes del cambio:
--            tools/respaldo-visitas-sin-foto-2026-09-26.json
-- ============================================================

-- Bloque 1
DROP POLICY IF EXISTS "visit_photos_update_own" ON storage.objects;
CREATE POLICY "visit_photos_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'visit-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'visit-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Bloque 2
UPDATE visits v
SET photo_urls = f.urls
FROM (
  SELECT (storage.foldername(o.name))[2] AS visit_id,
         array_agg(o.name ORDER BY split_part(split_part(o.name, '/', 3), '.', 1)::int) AS urls
  FROM storage.objects o
  WHERE o.bucket_id = 'visit-photos'
    AND split_part(split_part(o.name, '/', 3), '.', 1) ~ '^[0-9]+$'
  GROUP BY 1
) f
WHERE v.visit_id::text = f.visit_id
  AND coalesce(array_length(v.photo_urls, 1), 0) = 0
  AND (storage.foldername((f.urls)[1]))[1] = v.user_id::text;
