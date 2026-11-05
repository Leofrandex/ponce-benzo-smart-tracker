-- La lista de Mercaderistas y el grafico de cumplimiento salian de todo el que
-- tuviera rutas normales en el periodo, sin mirar el rol. Quien deja de ser
-- mercaderista (Jonathan Fernandez, 2026-11-04) seguia apareciendo por sus rutas
-- viejas. Ahora solo se listan los que hoy tienen rol merchandiser.
-- Las rutas y visitas historicas no se tocan.
create or replace function public.fn_dash_cumplimiento(p_desde date, p_hasta date)
 returns table(user_id uuid, full_name text, planificadas bigint, hechas bigint, cubiertas bigint, pct integer)
 language sql
 stable
 set search_path to ''
as $function$
  with planificado as (
    select r.user_id as uid, r.route_date, unnest(r.store_ids) as store_id
    from public.routes r
    where r.route_date between p_desde and least(p_hasta, public.fn_hoy() - 1)
      and not r.is_special
  ),
  en_alcance as (
    select p.uid, p.route_date, p.store_id
    from planificado p
    join public.stores s on s.store_id = p.store_id
    where public.fn_is_admin()
       or s.client_id in (select public.fn_my_client_ids())
  ),
  evaluado as (
    select e.uid,
           exists (
             select 1 from public.visits v
             where v.user_id = e.uid
               and v.store_id = e.store_id
               and public.fn_fecha_local(v.check_in_time) = e.route_date
               and v.status <> 'skipped'
           ) as propia,
           exists (
             select 1
             from public.visits v
             join public.sessions se on se.session_id = v.session_id
             join public.routes   r  on r.route_id    = se.route_id
             join public.users    u2 on u2.id         = v.user_id
             where v.store_id = e.store_id
               and public.fn_fecha_local(v.check_in_time) = e.route_date
               and v.status <> 'skipped'
               and r.is_special
               and (u2.is_supervisor or u2.role = 'admin')
           ) as cubierta
    from en_alcance e
  )
  select ev.uid,
         u.full_name,
         count(*)::bigint as planificadas,
         count(*) filter (where ev.propia or ev.cubierta)::bigint as hechas,
         count(*) filter (where not ev.propia and ev.cubierta)::bigint as cubiertas,
         case when count(*) = 0 then 0
              else round(100.0 * count(*) filter (where ev.propia or ev.cubierta) / count(*))::int
         end as pct
  from evaluado ev
  join public.users u on u.id = ev.uid
  where u.role = 'merchandiser'
  group by 1, 2
  order by 3 desc;
$function$;
