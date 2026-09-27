-- ============================================================
-- Migración 2026-09-27 — detalle de cumplimiento por mercaderista
--
-- Aplicar en el SQL editor de Supabase (producción).
--
-- Una fila por (día, tienda planificada) de un mercaderista, con qué pasó en
-- ella. MISMAS reglas que fn_dash_cumplimiento: si esta función y la del
-- dashboard divergen, el perfil y la barra del dashboard darían números
-- distintos. Cualquier cambio en una se replica en la otra.
-- ============================================================

create or replace function public.fn_mercaderista_detalle(p_user_id uuid, p_desde date, p_hasta date)
returns table(
  fecha date, store_id uuid, store_name text, client_name text,
  resultado text, skip_reason text, anomaly_type text[], visit_id uuid, check_in_time timestamptz
)
language sql
stable
set search_path to ''
as $function$
  with planificado as (
    select r.route_date, unnest(r.store_ids) as store_id
    from public.routes r
    where r.user_id = p_user_id
      and r.route_date between p_desde and least(p_hasta, public.fn_hoy() - 1)
      and not r.is_special
  ),
  en_alcance as (
    select p.route_date, p.store_id, s.name as store_name, c.name as client_name
    from planificado p
    join public.stores s on s.store_id = p.store_id
    left join public.clients c on c.client_id = s.client_id
    where public.fn_is_admin()
       or s.client_id in (select public.fn_my_client_ids())
  )
  select
    e.route_date,
    e.store_id,
    e.store_name,
    e.client_name,
    case
      when propia.visit_id is not null then case when propia.status = 'anomaly' then 'anomalia' else 'completada' end
      when cub.visit_id is not null then 'cubierta'
      when omit.visit_id is not null then 'omitida'
      else 'no_visitada'
    end,
    case when propia.visit_id is null and cub.visit_id is null then omit.skip_reason end,
    propia.anomaly_type,
    coalesce(propia.visit_id, cub.visit_id, omit.visit_id),
    coalesce(propia.check_in_time, cub.check_in_time, omit.check_in_time)
  from en_alcance e
  left join lateral (
    select v.visit_id, v.status, v.anomaly_type, v.check_in_time
    from public.visits v
    where v.user_id = p_user_id
      and v.store_id = e.store_id
      and public.fn_fecha_local(v.check_in_time) = e.route_date
      and v.status <> 'skipped'
    order by v.check_in_time desc
    limit 1
  ) propia on true
  left join lateral (
    select v.visit_id, v.check_in_time
    from public.visits v
    join public.sessions se on se.session_id = v.session_id
    join public.routes   r  on r.route_id    = se.route_id
    join public.users    u2 on u2.id         = v.user_id
    where v.store_id = e.store_id
      and public.fn_fecha_local(v.check_in_time) = e.route_date
      and v.status <> 'skipped'
      and r.is_special
      and (u2.is_supervisor or u2.role = 'admin')
    order by v.check_in_time desc
    limit 1
  ) cub on true
  left join lateral (
    select v.visit_id, v.skip_reason, v.check_in_time
    from public.visits v
    where v.user_id = p_user_id
      and v.store_id = e.store_id
      and public.fn_fecha_local(v.check_in_time) = e.route_date
      and v.status = 'skipped'
    order by v.check_in_time desc
    limit 1
  ) omit on true
  order by e.route_date desc, e.store_name;
$function$;
