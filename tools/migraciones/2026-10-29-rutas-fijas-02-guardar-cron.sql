-- 2026-10-29 — Rutas fijas editables (2/2: guardado y extension nocturna).
--   * fn_guardar_ruta: unico camino de escritura de route_plans/route_plan_stops
--     (lo llama el editor del hub). Valida, reemplaza las versiones enviadas y
--     rematerializa routes desde la primera fecha enviada hasta fn_hoy()+56.
--   * fn_extender_rutas + job pg_cron rutas_fijas_extender (01:00 Caracas):
--     mantiene materializadas las proximas 8 semanas de cada usuario con ruta fija.
-- Los mensajes de error los muestra el hub tal cual.

-- Defensa en profundidad: RLS ya solo permite select, pero sin privilegios
-- de escritura tampoco hay escritura aunque alguien agregue una politica.
revoke insert, update, delete, truncate on public.route_plans, public.route_plan_stops from anon, authenticated;

-- p_versiones: [{ "effective_from": "YYYY-MM-DD",
--                 "stops": [{ "weekday", "position", "store_id", "every_n_weeks", "anchor_monday" }] }]
-- p_version_esperada: max(created_at) de las versiones del usuario que vio el
-- editor (null si no tenia ninguna). Si cambio, otro admin guardo en medio.
create or replace function public.fn_guardar_ruta(
  p_user_id uuid, p_versiones jsonb, p_version_esperada timestamptz
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v jsonb;
  v_plan uuid;
  v_desde date;
begin
  if not public.fn_is_admin() then
    raise exception 'Solo administradores pueden editar rutas.';
  end if;

  select min((e->>'effective_from')::date) into v_desde
  from jsonb_array_elements(p_versiones) e;
  if v_desde is null or v_desde <= public.fn_hoy() then
    raise exception 'La fecha de inicio debe ser a partir de mañana.';
  end if;

  -- Serializa guardados del mismo usuario antes de comparar la version.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  if (select max(p.created_at) from public.route_plans p where p.user_id = p_user_id)
     is distinct from p_version_esperada then
    raise exception 'La ruta cambió mientras la editabas. Recarga para ver la versión actual.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_versiones) e, jsonb_array_elements(e->'stops') s
    group by e->>'effective_from', (s->>'weekday')::smallint, (s->>'store_id')::uuid
    having count(*) > 1
  ) then
    raise exception 'Una sucursal está repetida en el mismo día.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_versiones) e, jsonb_array_elements(e->'stops') s
    join public.stores st on st.store_id = (s->>'store_id')::uuid
    where not st.active
  ) then
    raise exception 'Hay sucursales inactivas en la ruta.';
  end if;

  for v in select value from jsonb_array_elements(p_versiones) loop
    delete from public.route_plans p
    where p.user_id = p_user_id and p.effective_from = (v->>'effective_from')::date;

    insert into public.route_plans (user_id, effective_from, created_by)
    values (p_user_id, (v->>'effective_from')::date, auth.uid())
    returning plan_id into v_plan;

    insert into public.route_plan_stops (plan_id, weekday, position, store_id, every_n_weeks, anchor_monday)
    select v_plan, (s->>'weekday')::smallint, (s->>'position')::smallint, (s->>'store_id')::uuid,
           (s->>'every_n_weeks')::smallint, (s->>'anchor_monday')::date
    from jsonb_array_elements(v->'stops') s;
  end loop;

  -- Borra lo que venia de la carga anterior (CSV) desde la primera fecha
  -- nueva, incluso fuera del horizonte; conserva especiales y dias con sesiones.
  delete from public.routes r
  where r.user_id = p_user_id and not r.is_special and r.route_date >= v_desde
    and not exists (select 1 from public.sessions se where se.route_id = r.route_id);

  perform public.fn_materializar_rutas(p_user_id, v_desde, public.fn_hoy() + 56);
end;
$$;

revoke all on function public.fn_guardar_ruta(uuid, jsonb, timestamptz) from public, anon;
grant execute on function public.fn_guardar_ruta(uuid, jsonb, timestamptz) to authenticated;

-- Extiende cada noche el horizonte de 8 semanas. Devuelve las filas escritas.
create or replace function public.fn_extender_rutas()
returns integer
language sql
security definer
set search_path to ''
as $$
  select coalesce(sum(public.fn_materializar_rutas(u.user_id, public.fn_hoy() + 1, public.fn_hoy() + 56)), 0)::integer
  from (select distinct p.user_id from public.route_plans p) u;
$$;

revoke all on function public.fn_extender_rutas() from public, anon, authenticated;

-- 05:00 UTC = 01:00 Caracas. Idempotente: reprogramar reemplaza el job.
select cron.unschedule(jobid) from cron.job where jobname = 'rutas_fijas_extender';
select cron.schedule('rutas_fijas_extender', '0 5 * * *', $$select public.fn_extender_rutas()$$);
