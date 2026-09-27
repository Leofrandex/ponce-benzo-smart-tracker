-- Chequeo de paridad: fn_dash_cumplimiento vs fn_mercaderista_detalle agregada.
--
-- Propósito: ambas funciones deben mantener las mismas reglas de negocio
-- (rutas no especiales, solo días pasados, "hecha" = completada/anomalía/cubierta,
-- alcance por fn_is_admin() o fn_my_client_ids()). Si divergen, la lista de
-- mercaderistas y el perfil individual mostrarían números distintos para el
-- mismo periodo.
--
-- Cómo correrlo: pegar en el editor SQL de Supabase, o pasarlo tal cual a
-- mcp__plugin_supabase_supabase__execute_sql (proyecto eknfqxetigmrteouaqnv).
-- Es de solo lectura: corre dentro de una transacción que se revierte (rollback).
--
-- Resultado esperado: en cada fila, planificadas = det_planificadas y
-- hechas = det_hechas. Cualquier diferencia indica que las dos funciones
-- dejaron de estar en paridad.

begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from public.users where email = 'dmori@ponce-benzo.com'), 'role', 'authenticated')::text, true);
set local role authenticated;
with d as (
  select m.user_id, x.*
  from (select distinct user_id from public.routes where route_date between current_date - 30 and current_date and not is_special) m
  cross join lateral public.fn_mercaderista_detalle(m.user_id, current_date - 30, current_date) x
),
det as (
  select user_id, count(*) planificadas,
         count(*) filter (where resultado in ('completada','anomalia','cubierta')) hechas
  from d group by user_id
)
select c.full_name, c.planificadas, det.planificadas as det_planificadas, c.hechas, det.hechas as det_hechas
from public.fn_dash_cumplimiento(current_date - 30, current_date) c
left join det on det.user_id = c.user_id;
rollback;
