-- 2026-10-29 — Rutas fijas editables (1/2: modelo y materializacion).
-- Hoy las rutas semanales de los mercaderistas solo existen como filas
-- sueltas en `routes` (una por usuario y dia) cargadas con service role; no
-- hay una plantilla que el admin pueda editar. Esta migracion agrega la
-- plantilla versionada:
--   * route_plans: una version por usuario, vigente desde effective_from
--     hasta la siguiente version.
--   * route_plan_stops: paradas por dia habil (1=lunes..5=viernes), con orden
--     y frecuencia (cada 1..4 semanas contadas desde anchor_monday).
-- Y la materializa en `routes`, que es lo que ya leen la app, los dashboards
-- (fn_dash_cumplimiento, fn_mercaderista_detalle) y el hub, asi nada de eso
-- cambia.
--
-- Reglas de la materializacion (fn_materializar_rutas):
--   * solo dias futuros (> fn_hoy()); hoy y el pasado no se tocan;
--   * nunca toca rutas especiales (is_special);
--   * conserva route_id (upsert sobre la fila normal del dia);
--   * un dia que queda vacio borra la fila normal solo si no tiene sesiones
--     (sessions.route_id es ON DELETE CASCADE).
-- La regla de visita (fn_toca_parada) es gemela de tocaEnFecha en
-- hub/app/lib/rutas/plan.ts: deben coincidir.
-- Escritura solo via funciones SECURITY DEFINER (la 2/2 agrega fn_guardar_ruta).

create table if not exists public.route_plans (
  plan_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  effective_from date not null,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  unique (user_id, effective_from)
);

create table if not exists public.route_plan_stops (
  plan_id uuid not null references public.route_plans on delete cascade,
  weekday smallint not null check (weekday between 1 and 5),
  position smallint not null check (position >= 1),
  store_id uuid not null references public.stores(store_id),
  every_n_weeks smallint not null check (every_n_weeks between 1 and 4),
  anchor_monday date not null check (extract(isodow from anchor_monday) = 1),
  primary key (plan_id, weekday, store_id)
);

alter table public.route_plans enable row level security;
alter table public.route_plan_stops enable row level security;

drop policy if exists "route_plans_staff_read" on public.route_plans;
create policy "route_plans_staff_read" on public.route_plans
  for select to authenticated using (true);

drop policy if exists "route_plan_stops_staff_read" on public.route_plan_stops;
create policy "route_plan_stops_staff_read" on public.route_plan_stops
  for select to authenticated using (true);

-- ¿Toca la parada en p_fecha? Mismo dia de semana y semanas desde el ancla
-- multiplo de p_n (modulo no negativo: vale para fechas antes del ancla).
create or replace function public.fn_toca_parada(
  p_weekday smallint, p_n smallint, p_anchor date, p_fecha date
)
returns boolean
language sql
immutable
set search_path to ''
as $$
  select extract(isodow from p_fecha) = p_weekday
     and ((((p_fecha - (extract(isodow from p_fecha)::int - 1)) - p_anchor) / 7) % p_n + p_n) % p_n = 0;
$$;

-- Reescribe en routes los dias habiles futuros de [p_desde, p_hasta] segun la
-- version vigente de cada dia. Devuelve las filas escritas (insert/update/delete).
create or replace function public.fn_materializar_rutas(
  p_user_id uuid, p_desde date, p_hasta date
)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  d date;
  v_plan uuid;
  v_stores uuid[];
  v_rc integer;
  v_n integer := 0;
begin
  for d in
    select g::date
    from generate_series(greatest(p_desde, public.fn_hoy() + 1)::timestamp, p_hasta::timestamp, interval '1 day') g
  loop
    continue when extract(isodow from d) > 5;

    select p.plan_id into v_plan
    from public.route_plans p
    where p.user_id = p_user_id and p.effective_from <= d
    order by p.effective_from desc
    limit 1;
    continue when v_plan is null;

    select array_agg(s.store_id order by s.position, s.store_id) into v_stores
    from public.route_plan_stops s
    join public.stores st on st.store_id = s.store_id
    where s.plan_id = v_plan
      and s.weekday = extract(isodow from d)
      and st.active
      and public.fn_toca_parada(s.weekday, s.every_n_weeks, s.anchor_monday, d);

    if v_stores is not null then
      insert into public.routes (user_id, route_date, store_ids, is_special)
      values (p_user_id, d, v_stores, false)
      on conflict (user_id, route_date) where not is_special
      do update set store_ids = excluded.store_ids
      where public.routes.store_ids is distinct from excluded.store_ids;
    else
      delete from public.routes r
      where r.user_id = p_user_id and r.route_date = d and not r.is_special
        and not exists (select 1 from public.sessions se where se.route_id = r.route_id);
    end if;
    get diagnostics v_rc = row_count;
    v_n := v_n + v_rc;
  end loop;
  return v_n;
end;
$$;

revoke all on function public.fn_materializar_rutas(uuid, date, date) from public, anon, authenticated;
