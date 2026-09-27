-- ============================================================
-- Migración 2026-09-27 — ids en funciones del dashboard (Bloque 2)
--
-- Aplicar en el SQL editor de Supabase (producción).
--
-- El dashboard enlaza "Visitas por cadena" a /panel/tiendas?client=<id> y
-- "Cumpleaños" a la ficha de la tienda: hacen falta client_id y store_id.
-- Cambiar el tipo de retorno exige DROP + CREATE; va en una transacción para
-- que el dashboard nunca vea la función ausente.
-- ============================================================

begin;

drop function if exists public.fn_dash_visitas_por_cliente(date, date);
create function public.fn_dash_visitas_por_cliente(p_desde date, p_hasta date)
returns table(client_id uuid, cliente text, visitas bigint, anomalias bigint)
language sql
stable
set search_path to ''
as $function$
  select c.client_id,
         coalesce(c.name, 'Sin cadena') as cliente,
         count(*)::bigint,
         count(*) filter (where v.status = 'anomaly')::bigint
  from public.visits v
  join public.stores s on s.store_id = v.store_id
  left join public.clients c on c.client_id = s.client_id
  where public.fn_fecha_local(v.check_in_time) between p_desde and p_hasta
    and v.status <> 'skipped'
    and (public.fn_is_admin() or s.client_id in (select public.fn_my_client_ids()))
  group by 1, 2
  order by 3 desc;
$function$;

drop function if exists public.fn_dash_cumpleanos(integer);
create function public.fn_dash_cumpleanos(p_dias integer)
returns table(contact_id uuid, store_id uuid, nombre text, cargo text, tienda text, cliente text, cumple date, dias_para integer)
language sql
stable
set search_path to ''
as $function$
  with c as (
    select ct.contact_id, ct.store_id, ct.full_name, ct.role_title, ct.birthday,
           s.name as tienda, coalesce(cl.name, 'Sin cadena') as cliente,
           -- Proxima ocurrencia del cumpleanos a partir de hoy.
           case
             when public.fn_cumple_en(ct.birthday, extract(year from public.fn_hoy())::int) >= public.fn_hoy()
             then public.fn_cumple_en(ct.birthday, extract(year from public.fn_hoy())::int)
             else public.fn_cumple_en(ct.birthday, extract(year from public.fn_hoy())::int + 1)
           end as proximo
    from public.contacts ct
    join public.stores s on s.store_id = ct.store_id
    left join public.clients cl on cl.client_id = s.client_id
    where ct.active and ct.birthday is not null
      and (public.fn_is_admin() or s.client_id in (select public.fn_my_client_ids()))
  )
  select c.contact_id, c.store_id, c.full_name, c.role_title, c.tienda, c.cliente,
         c.proximo, (c.proximo - public.fn_hoy())::int
  from c
  where c.proximo <= public.fn_hoy() + p_dias
  order by c.proximo, c.full_name;
$function$;

grant execute on function public.fn_dash_visitas_por_cliente(date, date) to authenticated;
grant execute on function public.fn_dash_cumpleanos(integer) to authenticated;

commit;
