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
-- Sección 2: guardado transaccional (fn_guardar_ruta), extensión nocturna
-- (fn_extender_rutas) y permisos.
--
-- Resultado esperado: todas las filas con ok = true (correr cada sección por separado).

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
       coalesce((select store_ids from _r where route_date = lun and is_special) = array[c]
       and (select store_ids from _r where route_date = public.fn_hoy() and not is_special) = array[c]
       and (select store_ids from _r where route_date = pasado and not is_special) = array[c], false)
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

-- ===================== Sección 2: guardado (fn_guardar_ruta) y extensión =====================
-- Correr aparte de la sección 1 (cada sección devuelve su propia tabla de ok).
-- Las llamadas al RPC van como authenticated impersonando al mercaderista de
-- prueba o a dmori (admin); los errores se capturan con pg_temp.intenta.
begin;

-- A, B: tiendas activas; C: se apaga dentro de la transacción. F: próximo lunes.
create temp table _ctx on commit drop as
select gen_random_uuid() as u,
       date_trunc('week', public.fn_hoy() + 7)::date as f,
       st[1] as a, st[2] as b, st[3] as c
from (select array_agg(store_id order by store_id) as st
      from (select store_id from public.stores where active order by store_id limit 3) x) s;
create temp table _res (caso text, ok boolean) on commit drop;

insert into auth.users (id, email)
select u, 'check-rutas-fijas-' || u || '@invalid.test' from _ctx;
insert into public.users (id, full_name, email, role)
select u, 'Check rutas fijas', 'check-rutas-fijas-' || u || '@invalid.test', 'merchandiser' from _ctx;
update public.stores set active = false where store_id = (select c from _ctx);

-- Filas normales sin sesión: F-1 se conserva; F+60 y F+90 (fuera del horizonte) se borran.
insert into public.routes (user_id, route_date, store_ids, is_special)
select u, v.d, array[a], false from _ctx, lateral (values (f - 1), (f + 60), (f + 90)) v(d);

create function pg_temp.parada(p_wd int, p_pos int, p_store uuid, p_anchor date) returns jsonb
language sql as $$
  select jsonb_build_object('weekday', p_wd, 'position', p_pos, 'store_id', p_store,
                            'every_n_weeks', 1, 'anchor_monday', p_anchor)
$$;
create function pg_temp.version(p_desde date, variadic p_stops jsonb[]) returns jsonb
language sql as $$
  select jsonb_build_object('effective_from', p_desde, 'stops', to_jsonb(p_stops))
$$;
-- Llama al RPC con el payload guardado en t.<p_payload>; devuelve 'ok' o el mensaje de error.
create function pg_temp.intenta(p_payload text, p_esperada timestamptz) returns text
language plpgsql as $$
begin
  perform public.fn_guardar_ruta(current_setting('t.u')::uuid, current_setting('t.' || p_payload)::jsonb, p_esperada);
  return 'ok';
exception when others then
  return sqlerrm;
end
$$;

select set_config('t.u', u::text, true),
       set_config('t.p_hoy', jsonb_build_array(pg_temp.version(public.fn_hoy(), pg_temp.parada(1, 1, a, f)))::text, true),
       set_config('t.p_dup', jsonb_build_array(pg_temp.version(f, pg_temp.parada(1, 1, a, f), pg_temp.parada(1, 2, a, f)))::text, true),
       set_config('t.p_inact', jsonb_build_array(pg_temp.version(f, pg_temp.parada(1, 1, c, f)))::text, true),
       set_config('t.p_a', jsonb_build_array(pg_temp.version(f, pg_temp.parada(1, 1, a, f)))::text, true),
       set_config('t.p_ab', jsonb_build_array(pg_temp.version(f, pg_temp.parada(1, 1, a, f), pg_temp.parada(1, 2, b, f)))::text, true),
       set_config('t.p_dos', jsonb_build_array(pg_temp.version(f, pg_temp.parada(1, 1, a, f)),
                                               pg_temp.version(f + 14, pg_temp.parada(1, 1, b, f)))::text, true)
from _ctx;

-- Mercaderista: no puede editar.
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('t.r_no_admin', pg_temp.intenta('p_a', null), true);
reset role;

-- Admin.
select set_config('request.jwt.claims', json_build_object('sub', (select id from public.users where email = 'dmori@ponce-benzo.com'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('t.r_hoy', pg_temp.intenta('p_hoy', null), true);
select set_config('t.r_dup', pg_temp.intenta('p_dup', null), true);
select set_config('t.r_inact', pg_temp.intenta('p_inact', null), true);
select set_config('t.r_v1', pg_temp.intenta('p_a', null), true);   -- primera versión
select set_config('t.r_v2', pg_temp.intenta('p_a', null), true);   -- editor desactualizado
reset role;
select set_config('t.ver', (select max(p.created_at)::text from public.route_plans p, _ctx where p.user_id = _ctx.u), true);
set local role authenticated;
select set_config('t.r_v3', pg_temp.intenta('p_ab', current_setting('t.ver')::timestamptz), true);  -- reemplaza F
reset role;

insert into _res
select 'no_admin', coalesce(current_setting('t.r_no_admin') = 'Solo administradores pueden editar rutas.', false)
union all
select 'fecha_hoy', coalesce(current_setting('t.r_hoy') = 'La fecha de inicio debe ser a partir de mañana.', false)
union all
select 'duplicado', coalesce(current_setting('t.r_dup') = 'Una sucursal está repetida en el mismo día.', false)
union all
select 'inactiva', coalesce(current_setting('t.r_inact') = 'Hay sucursales inactivas en la ruta.', false)
union all
select 'version_esperada',
       coalesce(current_setting('t.r_v1') = 'ok'
       and current_setting('t.r_v2') = 'La ruta cambió mientras la editabas. Recarga para ver la versión actual.'
       and current_setting('t.r_v3') = 'ok', false)
union all
select 'reemplaza_misma_fecha',
       coalesce((select count(*) from public.route_plans p where p.user_id = u and p.effective_from = f) = 1
       and (select array_agg(s.store_id order by s.position) from public.route_plan_stops s
            join public.route_plans p using (plan_id) where p.user_id = u and p.effective_from = f) = array[a, b]
       and (select store_ids from public.routes r where r.user_id = u and r.route_date = f and not r.is_special) = array[a, b], false)
from _ctx
union all
select 'borra_csv_desde_fecha',
       coalesce(exists (select 1 from public.routes r where r.user_id = u and r.route_date = f - 1)
       and not exists (select 1 from public.routes r where r.user_id = u and r.route_date in (f + 60, f + 90)), false)
from _ctx;

-- Dos versiones en un solo guardado.
select set_config('t.ver', (select max(p.created_at)::text from public.route_plans p, _ctx where p.user_id = _ctx.u), true);
set local role authenticated;
select set_config('t.r_dos', pg_temp.intenta('p_dos', current_setting('t.ver')::timestamptz), true);
reset role;

insert into _res
select 'varias_versiones',
       coalesce(current_setting('t.r_dos') = 'ok'
       and (select array_agg(p.effective_from order by p.effective_from) from public.route_plans p where p.user_id = u) = array[f, f + 14]
       and (select store_ids from public.routes r where r.user_id = u and r.route_date = f + 7 and not r.is_special) = array[a]
       and (select store_ids from public.routes r where r.user_id = u and r.route_date = f + 14 and not r.is_special) = array[b], false)
from _ctx;

-- Extensión nocturna: recrea un día futuro que falta.
delete from public.routes r using _ctx where r.user_id = _ctx.u and r.route_date = _ctx.f + 7;
select public.fn_extender_rutas();
insert into _res
select 'extender',
       coalesce((select store_ids from public.routes r where r.user_id = u and r.route_date = f + 7 and not r.is_special) = array[a], false)
from _ctx;

-- Permisos: solo authenticated ejecuta el guardado; nadie escribe directo en las tablas.
insert into _res
select 'permisos',
       coalesce(has_function_privilege('authenticated', 'public.fn_guardar_ruta(uuid, jsonb, timestamptz)', 'execute')
       and not has_function_privilege('anon', 'public.fn_guardar_ruta(uuid, jsonb, timestamptz)', 'execute')
       and not has_function_privilege('authenticated', 'public.fn_extender_rutas()', 'execute')
       and not has_function_privilege('anon', 'public.fn_extender_rutas()', 'execute')
       and not has_table_privilege('authenticated', 'public.route_plans', 'insert, update, delete, truncate')
       and not has_table_privilege('anon', 'public.route_plans', 'insert, update, delete, truncate')
       and not has_table_privilege('authenticated', 'public.route_plan_stops', 'insert, update, delete, truncate')
       and not has_table_privilege('anon', 'public.route_plan_stops', 'insert, update, delete, truncate'), false);

select * from _res;

rollback;
