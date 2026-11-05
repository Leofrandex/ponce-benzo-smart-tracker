-- 2026-11-05 — Reabrir desde el hub la ruta de hoy de un mercaderista.
--   * sessions.reopened_at / reopened_by: auditoria. La app no las envia en su upsert.
--   * fn_reabrir_ruta: solo admin. El telefono se entera al leer session_end (1.4.0 en adelante).
--   * close_stale_sessions: cuenta la reapertura como actividad. El job corre cada 30 min y
--     cierra lo que lleve 3 h sin pings: sin este cambio, una ruta terminada hace mas de 3 h
--     se volvia a cerrar antes de que el telefono abriera la app.
-- Idempotente. Los mensajes de error los muestra el hub tal cual.

set local lock_timeout = '5s';

alter table public.sessions
  add column if not exists reopened_at timestamptz,
  add column if not exists reopened_by uuid;

create or replace function public.fn_reabrir_ruta(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_session_id uuid;
  v_end timestamptz;
begin
  if not public.fn_is_admin() then
    raise exception 'Solo administradores pueden reabrir rutas.' using errcode = '42501';
  end if;

  -- El bloqueo evita pisar un cierre que este subiendo el telefono en este momento.
  select s.session_id, s.session_end into v_session_id, v_end
  from public.sessions s
  where s.user_id = p_user_id
    and public.fn_fecha_local(s.session_start) = public.fn_hoy()
  order by s.session_start desc, s.session_id desc
  limit 1
  for update;

  if not found then
    raise exception 'Este usuario no tiene una ruta iniciada hoy.' using errcode = 'P0002';
  end if;

  if v_end is null then
    raise exception 'La ruta de hoy ya está abierta.' using errcode = '22023';
  end if;

  update public.sessions
  set session_end = null, reopened_at = now(), reopened_by = auth.uid()
  where session_id = v_session_id;

  return v_session_id;
end;
$$;

-- Igual a la de 2026-09-06, salvo que reopened_at cuenta como ultima actividad.
create or replace function public.close_stale_sessions(max_idle interval default interval '3 hours')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  closed_count integer;
begin
  with last_ping as (
    select s.session_id,
           greatest(coalesce(max(p."timestamp"), s.session_start), s.reopened_at) as last_seen
    from public.sessions s
    left join public.location_pings p on p.session_id = s.session_id
    where s.session_end is null
    group by s.session_id, s.session_start, s.reopened_at
  ),
  closed as (
    update public.sessions s
    set session_end = lp.last_seen
    from last_ping lp
    where s.session_id = lp.session_id
      and lp.last_seen < now() - max_idle
    returning s.session_id
  )
  select count(*) into closed_count from closed;
  return closed_count;
end;
$$;

revoke all on function public.close_stale_sessions(interval) from public, anon, authenticated;

revoke all on function public.fn_reabrir_ruta(uuid) from public, anon;
grant execute on function public.fn_reabrir_ruta(uuid) to authenticated, service_role;
