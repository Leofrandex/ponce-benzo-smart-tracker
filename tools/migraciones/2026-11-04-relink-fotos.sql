-- 2026-11-04 — Re-enlace nocturno de fotos huerfanas (P8).
-- Si la subida a Storage termino pero la fila (visits / competition_reports)
-- quedo con photo_urls nulo o incompleto, este job lo repara. Solo agrega:
-- nunca quita una ruta ya enlazada. Revisa solo filas de los ultimos 30 dias.
-- Convencion: bucket visit-photos, objeto <user_id>/<id>/<n>.jpg (id = visit_id
-- o report_id). Se ignoran nombres que no calcen y objetos de tamano 0 o sin tamano.
-- El UPDATE solo toca columna photo_urls: ningun trigger de visits
-- (status / last_restock_date / store_id) se dispara.

create or replace function public.fn_relink_fotos()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_n integer := 0;
  v_k integer;
begin
  -- Union (rutas ya enlazadas + objetos hallados), ordenada por n numerico.
  with o as materialized (
    select split_part(x.name, '/', 1) as uid, split_part(x.name, '/', 2) as id, array_agg(x.name) as names
    from storage.objects x
    where x.bucket_id = 'visit-photos'
      and x.name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9]+\.jpg$'
      and coalesce((x.metadata->>'size')::bigint, 0) > 0
    group by 1, 2
  ),
  m as (
    select t.visit_id, t.photo_urls as cur,
           array(
             select p from unnest(coalesce(t.photo_urls, '{}') || coalesce(o.names, '{}')) as p
             group by p
             order by substring(p from '([0-9]+)\.jpg$')::int nulls last, p
           ) as merged
    from public.visits t
    left join o on o.uid = t.user_id::text and o.id = t.visit_id::text
    where t.check_in_time >= now() - interval '30 days'
  )
  update public.visits v set photo_urls = m.merged
  from m
  where m.visit_id = v.visit_id and m.merged is distinct from coalesce(m.cur, '{}');
  get diagnostics v_k = row_count;
  v_n := v_n + v_k;

  with o as materialized (
    select split_part(x.name, '/', 1) as uid, split_part(x.name, '/', 2) as id, array_agg(x.name) as names
    from storage.objects x
    where x.bucket_id = 'visit-photos'
      and x.name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9]+\.jpg$'
      and coalesce((x.metadata->>'size')::bigint, 0) > 0
    group by 1, 2
  ),
  m as (
    select t.report_id, t.photo_urls as cur,
           array(
             select p from unnest(coalesce(t.photo_urls, '{}') || coalesce(o.names, '{}')) as p
             group by p
             order by substring(p from '([0-9]+)\.jpg$')::int nulls last, p
           ) as merged
    from public.competition_reports t
    left join o on o.uid = t.user_id::text and o.id = t.report_id::text
    where t.created_at >= now() - interval '30 days'
  )
  update public.competition_reports r set photo_urls = m.merged
  from m
  where m.report_id = r.report_id and m.merged is distinct from coalesce(m.cur, '{}');
  get diagnostics v_k = row_count;
  v_n := v_n + v_k;

  return v_n;
end;
$$;

revoke all on function public.fn_relink_fotos() from public, anon, authenticated;

-- 06:00 UTC = 02:00 Caracas. Idempotente: reprogramar reemplaza el job.
select cron.unschedule(jobid) from cron.job where jobname = 'relink_fotos';
select cron.schedule('relink_fotos', '0 6 * * *', $$select public.fn_relink_fotos()$$);
