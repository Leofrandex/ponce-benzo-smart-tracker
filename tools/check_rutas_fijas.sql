-- Chequeo de rutas fijas (route_plans / route_plan_stops -> routes).
--
-- Propósito: verificar la regla de visita (fn_toca_parada, gemela de
-- tocaEnFecha en hub/app/lib/rutas/plan.ts) y la materialización
-- (fn_materializar_rutas): qué escribe en routes, qué conserva (route_id,
-- filas con sesiones, el día de hoy y las rutas especiales) y cómo elige la
-- versión vigente cuando una versión entra a mitad de semana.
--
-- Cómo correrlo: pasarlo tal cual a mcp__plugin_supabase_supabase__execute_sql
-- (proyecto eknfqxetigmrteouaqnv) o pegarlo en el editor SQL de Supabase.
-- Crea un usuario de prueba, versiones y filas dentro de una transacción que
-- se revierte (rollback): nada persiste.
--
-- Resultado esperado: todas las filas con ok = true.

-- ===================== Sección 1: modelo y materialización =====================
begin;

-- A, B: tiendas activas; C: activa hoy, se apaga dentro de la transacción.
create temp table _ctx on commit drop as
select gen_random_uuid() as u,
       gen_random_uuid() as r_lun,      -- ruta normal preexistente del primer lunes
       gen_random_uuid() as r_mar,      -- ruta del primer martes, con sesión
       date_trunc('week', public.fn_hoy() + 7)::date as lun,
       (select min(g::date) from generate_series((public.fn_hoy() - 7)::timestamp, (public.fn_hoy() - 1)::timestamp, interval '1 day') g
        where extract(isodow from g) <= 5) as pasado,  -- dia habil pasado
       st[1] as a, st[2] as b, st[3] as c
from (select array_agg(store_id order by store_id) as st
      from (select store_id from public.stores where active order by store_id limit 3) x) s;

insert into auth.users (id, email)
select u, 'check-rutas-fijas-' || u || '@invalid.test' from _ctx;
insert into public.users (id, full_name, email, role)
select u, 'Check rutas fijas', 'check-rutas-fijas-' || u || '@invalid.test', 'merchandiser' from _ctx;
update public.stores set active = false where store_id = (select c from _ctx);

-- Filas preexistentes en routes.
insert into public.routes (route_id, user_id, route_date, store_ids, is_special)
select r_lun, u, lun, array[c], false from _ctx;
insert into public.routes (user_id, route_date, store_ids, is_special)
select u, lun, array[c], true from _ctx;                            -- especial del primer lunes
insert into public.routes (user_id, route_date, store_ids, is_special)
select u, public.fn_hoy(), array[c], false from _ctx;               -- hoy
insert into public.routes (route_id, user_id, route_date, store_ids, is_special)
select r_mar, u, lun + 1, array[a], false from _ctx;               -- martes futuro
insert into public.sessions (user_id, route_id, start_location)
select u, r_mar, '{}'::jsonb from _ctx;
insert into public.routes (user_id, route_date, store_ids, is_special)
select u, lun + 3, array[a], false from _ctx;                      -- jueves futuro sin sesion: se borra
insert into public.routes (user_id, route_date, store_ids, is_special)
select u, pasado, array[c], false from _ctx;                       -- dia habil pasado: v0 lo borraria

-- v0: pasada y vacía (si no se respetara hoy, borraría la fila de hoy y la del día pasado).
-- v1: desde el próximo lunes. Lunes: A semanal, B cada 2 (ancla ese lunes), C semanal inactiva.
-- v2: desde el miércoles de la segunda semana. Lunes vacío, miércoles A.
insert into public.route_plans (user_id, effective_from)
select u, public.fn_hoy() - 14 from _ctx
union all select u, lun from _ctx
union all select u, lun + 9 from _ctx;

insert into public.route_plan_stops (plan_id, weekday, position, store_id, every_n_weeks, anchor_monday)
select p.plan_id, v.wd, v.pos, v.store_id, v.n, v.anchor
from _ctx, public.route_plans p
cross join lateral (values
  (1::smallint, 1::smallint, _ctx.a, 1::smallint, _ctx.lun),
  (1::smallint, 2::smallint, _ctx.b, 2::smallint, _ctx.lun),
  (1::smallint, 3::smallint, _ctx.c, 1::smallint, _ctx.lun)
) v(wd, pos, store_id, n, anchor)
where p.user_id = _ctx.u and p.effective_from = _ctx.lun
union all
select p.plan_id, 3::smallint, 1::smallint, _ctx.a, 1::smallint, _ctx.lun + 7
from _ctx, public.route_plans p
where p.user_id = _ctx.u and p.effective_from = _ctx.lun + 9;

select public.fn_materializar_rutas(u, public.fn_hoy() - 7, lun + 13) from _ctx;

create temp view _r as
select r.* from public.routes r, _ctx where r.user_id = _ctx.u;

select 'regla' as caso,
       public.fn_toca_parada(1::smallint, 2::smallint, '2026-11-16', '2026-11-30')
       and not public.fn_toca_parada(1::smallint, 2::smallint, '2026-11-16', '2026-11-09')
       and public.fn_toca_parada(1::smallint, 2::smallint, '2026-12-28', '2027-01-11') as ok
union all
select 'materializa',
       (select store_ids from _r where route_date = lun and not is_special) = array[a, b]
       and (select store_ids from _r where route_date = lun + 7 and not is_special) = array[a]
       and not exists (select 1 from _r where route_date = lun + 8)
       and not exists (select 1 from _r where route_date = lun + 2)
from _ctx
union all
select 'inactiva',
       array_position((select store_ids from _r where route_date = lun and not is_special), c) is null
       and exists (select 1 from _r where route_date = lun and not is_special)
from _ctx
union all
select 'conserva_route_id',
       (select route_id from _r where route_date = lun and not is_special) = r_lun
       and (select store_ids from _r where route_id = r_lun) = array[a, b]
from _ctx
union all
select 'no_borra_con_sesion',
       coalesce((select store_ids from _r where route_id = r_mar) = array[a], false)
from _ctx
union all
select 'no_toca_hoy_ni_especiales',
       (select store_ids from _r where route_date = lun and is_special) = array[c]
       and (select store_ids from _r where route_date = public.fn_hoy() and not is_special) = array[c]
       and (select store_ids from _r where route_date = pasado and not is_special) = array[c]
from _ctx
union all
select 'borra_sin_sesion',
       not exists (select 1 from _r where route_date = lun + 3)
from _ctx
union all
select 'mitad_semana',
       (select store_ids from _r where route_date = lun + 7 and not is_special) = array[a]
       and (select store_ids from _r where route_date = lun + 9 and not is_special) = array[a]
from _ctx;

rollback;
