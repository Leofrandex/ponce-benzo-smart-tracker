-- ============================================================
-- Migración 2026-09-30 — tarjeta "Visitas con foto" del dashboard
--
-- Aplicar en el SQL editor de Supabase (producción).
--
-- Diego pidió foto obligatoria en toda visita (reunión 2026-09-25). Esta
-- función da, por autor de la visita, cuántas visitas hizo en el período y
-- cuántas quedaron con al menos una foto. Las omitidas (skipped) no cuentan:
-- ahí no hay nada que fotografiar.
--
-- OJO: la app sube la visita primero y las fotos después (BUG-029). Una
-- visita de hoy sin fotos puede estar todavía subiéndolas; el hub lo avisa.
-- ============================================================

create or replace function public.fn_dash_visitas_con_foto(p_desde date, p_hasta date)
returns table(user_id uuid, full_name text, visitas bigint, con_foto bigint)
language sql
stable
set search_path to ''
as $function$
  select v.user_id,
         u.full_name,
         count(*)::bigint,
         count(*) filter (where coalesce(cardinality(v.photo_urls), 0) > 0)::bigint
  from public.visits v
  join public.stores s on s.store_id = v.store_id
  join public.users  u on u.id       = v.user_id
  where public.fn_fecha_local(v.check_in_time) between p_desde and p_hasta
    and v.status <> 'skipped'
    and (public.fn_is_admin() or s.client_id in (select public.fn_my_client_ids()))
  group by 1, 2
  -- Primero quien más visitas sin foto acumula: es a quien hay que llamar.
  order by count(*) - count(*) filter (where coalesce(cardinality(v.photo_urls), 0) > 0) desc, 3 desc;
$function$;

grant execute on function public.fn_dash_visitas_con_foto(date, date) to authenticated;
