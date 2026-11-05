-- 2026-11-04 — Ronda P&B, datos: codigo PDV, carga masiva, historial de GPS y duracion de visita.
--   * stores.pdv_code: nula en las filas existentes; las nuevas la toman de store_pdv_seq (desde PDV-1001).
--   * store_code_aliases: alias y codigos reservados que la carga masiva tambien detecta.
--   * store_gps_history + fn_capturar_gps_tienda / fn_restaurar_gps_tienda.
--   * fn_crear_cliente, fn_cargar_clientes, fn_cargar_tiendas: solo admin.
--   * visits.started_at, expuesta en fn_mercaderista_detalle.
-- Idempotente. Los mensajes de error los muestra el hub tal cual.

-- ---------------------------------------------------------------------------
-- Normalizacion
-- ---------------------------------------------------------------------------

-- Minusculas, sin acentos, espacios colapsados y recortados. No usa unaccent.
-- chr(160) es el espacio duro que suele traer Excel.
-- Debe coincidir con normTexto del hub.
create or replace function public.fn_norm_texto(p text)
returns text
language sql
immutable
set search_path to ''
as $$
  select btrim(regexp_replace(
    lower(translate(p, 'áéíóúüñÁÉÍÓÚÜÑ' || chr(160), 'aeiouunaeiouun ')),
    '\s+', ' ', 'g'
  ));
$$;

-- ---------------------------------------------------------------------------
-- Codigo PDV
-- ---------------------------------------------------------------------------

create sequence if not exists public.store_pdv_seq start 1001;
-- Solo se consume a traves de fn_next_pdv.
revoke all on sequence public.store_pdv_seq from public, anon, authenticated;

create or replace function public.fn_next_pdv()
returns text
language sql
security definer
set search_path to ''
as $$
  select 'PDV-' || nextval('public.store_pdv_seq'::regclass)::text;
$$;

-- Primero sin default, para que las filas existentes queden nulas.
alter table public.stores
  add column if not exists pdv_code text
    constraint stores_pdv_code_key unique
    constraint stores_pdv_code_formato check (pdv_code ~ '^PDV-[0-9]{4,}$');
alter table public.stores alter column pdv_code set default public.fn_next_pdv();

create table if not exists public.store_code_aliases (
  code     text primary key,
  store_id uuid null references public.stores (store_id),
  kind     text check (kind in ('alias', 'reservado')),
  note     text
);

alter table public.store_code_aliases enable row level security;
revoke all on public.store_code_aliases from anon;
revoke truncate on public.store_code_aliases from authenticated;

drop policy if exists store_code_aliases_read on public.store_code_aliases;
create policy store_code_aliases_read on public.store_code_aliases
  for select to authenticated using (true);

drop policy if exists store_code_aliases_admin_all on public.store_code_aliases;
create policy store_code_aliases_admin_all on public.store_code_aliases
  for all to authenticated using (public.fn_is_admin()) with check (public.fn_is_admin());

-- ---------------------------------------------------------------------------
-- Historial de GPS
-- ---------------------------------------------------------------------------

create table if not exists public.store_gps_history (
  history_id uuid primary key default gen_random_uuid(),
  capture_id uuid unique null,
  store_id   uuid not null references public.stores (store_id),
  changed_by uuid not null,
  changed_at timestamptz not null,
  old_lat    double precision,
  old_lng    double precision,
  new_lat    double precision,
  new_lng    double precision,
  kind       text check (kind in ('captura', 'restauracion'))
);

create index if not exists store_gps_history_store_idx
  on public.store_gps_history (store_id, changed_at desc);

alter table public.store_gps_history enable row level security;
-- Sin escritura directa: solo las funciones de abajo.
revoke all on public.store_gps_history from anon;
revoke insert, update, delete, truncate on public.store_gps_history from authenticated;

drop policy if exists store_gps_history_read on public.store_gps_history;
create policy store_gps_history_read on public.store_gps_history
  for select to authenticated
  using (public.fn_is_admin() or public.fn_can_see_store(store_id));

-- Idempotente por p_capture_id: la app reintenta sin conexion.
-- Una captura vieja queda en el historial pero no pisa un cambio mas reciente.
create or replace function public.fn_capturar_gps_tienda(
  p_capture_id uuid, p_store_id uuid, p_lat double precision, p_lng double precision, p_captured_at timestamptz
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_old_lat double precision;
  v_old_lng double precision;
  v_hay_mas_reciente boolean;
  v_captured_at timestamptz;
begin
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.active) then
    raise exception 'Usuario no autorizado para capturar GPS.' using errcode = '42501';
  end if;

  if p_capture_id is null or p_captured_at is null then
    raise exception 'La captura de GPS está incompleta.' using errcode = '22023';
  end if;

  -- Un telefono con el reloj adelantado no debe bloquear las capturas siguientes.
  v_captured_at := case when p_captured_at > now() + interval '5 minutes' then now() else p_captured_at end;

  -- NaN e infinito tambien caen aqui.
  if p_lat is null or p_lng is null
     or p_lat not between -90 and 90
     or p_lng not between -180 and 180 then
    raise exception 'Coordenadas fuera de rango.' using errcode = '22023';
  end if;

  -- El bloqueo serializa capturas y restauraciones de la misma tienda.
  select s.master_lat, s.master_lng into v_old_lat, v_old_lng
  from public.stores s
  where s.store_id = p_store_id
  for update;
  if not found then
    raise exception 'La tienda no existe.' using errcode = 'P0002';
  end if;

  v_hay_mas_reciente := exists (
    select 1 from public.store_gps_history h
    where h.store_id = p_store_id and h.changed_at > v_captured_at
  );

  insert into public.store_gps_history
    (capture_id, store_id, changed_by, changed_at, old_lat, old_lng, new_lat, new_lng, kind)
  values
    (p_capture_id, p_store_id, auth.uid(), v_captured_at, v_old_lat, v_old_lng, p_lat, p_lng, 'captura')
  on conflict (capture_id) do nothing;
  if not found then
    return;
  end if;

  if not v_hay_mas_reciente then
    update public.stores
    set master_lat = p_lat, master_lng = p_lng
    where store_id = p_store_id;
  end if;
end;
$$;

create or replace function public.fn_restaurar_gps_tienda(p_history_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_store_id uuid;
  v_lat double precision;
  v_lng double precision;
  v_old_lat double precision;
  v_old_lng double precision;
begin
  if not public.fn_is_admin() then
    raise exception 'Solo administradores pueden restaurar el GPS.' using errcode = '42501';
  end if;

  select h.store_id, h.old_lat, h.old_lng into v_store_id, v_lat, v_lng
  from public.store_gps_history h
  where h.history_id = p_history_id;
  if not found then
    raise exception 'El registro de historial no existe.' using errcode = 'P0002';
  end if;

  select s.master_lat, s.master_lng into v_old_lat, v_old_lng
  from public.stores s
  where s.store_id = v_store_id
  for update;

  update public.stores
  set master_lat = v_lat, master_lng = v_lng
  where store_id = v_store_id;

  insert into public.store_gps_history
    (store_id, changed_by, changed_at, old_lat, old_lng, new_lat, new_lng, kind)
  values
    (v_store_id, auth.uid(), now(), v_old_lat, v_old_lng, v_lat, v_lng, 'restauracion');
end;
$$;

-- ---------------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------------

-- Repetido por nombre normalizado o RIF, incluidos prospectos: error 23505.
create or replace function public.fn_crear_cliente(p_name text, p_channel text, p_rif text, p_vendedor uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_existente text;
  v_client_id uuid;
begin
  if not public.fn_is_admin() then
    raise exception 'Solo administradores pueden crear clientes.' using errcode = '42501';
  end if;

  if coalesce(public.fn_norm_texto(p_name), '') = '' or coalesce(btrim(p_channel), '') = '' then
    raise exception 'El nombre y el canal del cliente son obligatorios.' using errcode = '22023';
  end if;

  if p_vendedor is not null and not exists (
    select 1 from public.users u where u.id = p_vendedor and u.role = 'vendedor' and u.active
  ) then
    raise exception 'El vendedor indicado no es un vendedor activo.' using errcode = '22023';
  end if;

  -- Serializa con otras altas: comprobar y luego insertar.
  perform pg_advisory_xact_lock(hashtext('alta_clientes'));

  select c.name into v_existente
  from public.clients c
  where public.fn_norm_texto(c.name) = public.fn_norm_texto(p_name)
  limit 1;
  if found then
    raise exception 'Ya existe un cliente con ese nombre: %.', v_existente using errcode = '23505';
  end if;

  select c.name into v_existente
  from public.clients c
  where public.fn_norm_rif(c.rif) = public.fn_norm_rif(p_rif)
  limit 1;
  if found then
    raise exception 'Ya existe un cliente con ese RIF: %.', v_existente using errcode = '23505';
  end if;

  insert into public.clients (name, business_channel, rif, status)
  values (btrim(p_name), p_channel, nullif(btrim(p_rif), ''), 'activo')
  returning client_id into v_client_id;

  if p_vendedor is not null then
    insert into public.client_assignments (user_id, client_id) values (p_vendedor, v_client_id);
  end if;

  return v_client_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Carga masiva
-- ---------------------------------------------------------------------------

-- p_filas: [{ "fila", "name", "business_channel", "rif", "vendedor_id" }]
-- Repetidas se reportan y se saltan; cualquier otro error aborta toda la carga.
create or replace function public.fn_cargar_clientes(p_filas jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_fila jsonb;
  v_nombre text;
  v_rif text;
  -- Todas las filas ya vistas cuentan, tambien las que se saltaron.
  v_nombres text[] := '{}';
  v_rifs text[] := '{}';
  v_insertadas int := 0;
  v_repetidas jsonb := '[]';
begin
  if not public.fn_is_admin() then
    raise exception 'Solo administradores pueden hacer carga masiva.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext('alta_clientes'));

  for v_fila in select e from jsonb_array_elements(p_filas) e loop
    v_nombre := public.fn_norm_texto(v_fila->>'name');
    v_rif := public.fn_norm_rif(v_fila->>'rif');

    if v_nombre = any (v_nombres) or v_rif = any (v_rifs) then
      v_repetidas := v_repetidas || jsonb_build_object(
        'fila', (v_fila->>'fila')::int,
        'motivo', 'Repetida dentro del archivo: mismo nombre o RIF que una fila anterior.'
      );
    else
      begin
        perform public.fn_crear_cliente(
          v_fila->>'name', v_fila->>'business_channel', v_fila->>'rif',
          nullif(v_fila->>'vendedor_id', '')::uuid
        );
        v_insertadas := v_insertadas + 1;
      exception when unique_violation then
        v_repetidas := v_repetidas || jsonb_build_object('fila', (v_fila->>'fila')::int, 'motivo', sqlerrm);
      end;
    end if;

    v_nombres := v_nombres || v_nombre;
    v_rifs := v_rifs || v_rif;
  end loop;

  return jsonb_build_object('insertadas', v_insertadas, 'repetidas', v_repetidas);
end;
$$;

-- p_filas: [{ "fila", "client_id", "name", "business_channel", "estado", "municipio", "address",
--             "urbanizacion", "ciudad", "region", "master_lat", "master_lng", "pdv_code" }]
-- Repetida: codigo PDV en stores o en store_code_aliases, o mismo cliente y nombre
-- normalizado en stores (tambien inactivas) o en una fila anterior del archivo.
-- Cualquier otro error aborta toda la carga.
create or replace function public.fn_cargar_tiendas(p_filas jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_fila jsonb;
  v_faltan text;
  v_cliente uuid;
  v_clave text;
  v_codigo text;
  v_kind text;
  v_lat double precision;
  v_lng double precision;
  v_motivo text;
  v_existentes text[];
  -- Todas las filas ya vistas cuentan, tambien las que se saltaron.
  v_vistas text[] := '{}';
  v_insertadas int := 0;
  v_repetidas jsonb := '[]';
begin
  if not public.fn_is_admin() then
    raise exception 'Solo administradores pueden hacer carga masiva.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext('alta_tiendas'));

  -- Una sola pasada: normalizar stores por cada fila seria cuadratico.
  select coalesce(array_agg(s.client_id::text || '|' || public.fn_norm_texto(s.name)), '{}')
  into v_existentes
  from public.stores s
  where s.client_id is not null;

  for v_fila in select e from jsonb_array_elements(p_filas) e loop
    select string_agg(k, ', ') into v_faltan
    from unnest(array['client_id', 'name', 'business_channel', 'estado', 'municipio', 'address']) k
    where coalesce(btrim(v_fila->>k), '') = '';
    if v_faltan is not null then
      raise exception 'Fila %: faltan campos obligatorios: %.', v_fila->>'fila', v_faltan using errcode = '22023';
    end if;

    v_cliente := (v_fila->>'client_id')::uuid;
    v_clave := v_cliente::text || '|' || public.fn_norm_texto(v_fila->>'name');
    v_codigo := nullif(btrim(v_fila->>'pdv_code'), '');
    v_motivo := null;

    if v_codigo is not null then
      if exists (select 1 from public.stores s where s.pdv_code = v_codigo) then
        v_motivo := format('El código %s ya existe.', v_codigo);
      else
        select a.kind into v_kind from public.store_code_aliases a where a.code = v_codigo;
        if found then
          v_motivo := case v_kind
            when 'reservado' then format('El código %s está reservado.', v_codigo)
            else format('El código %s es un alias de otra tienda.', v_codigo)
          end;
        end if;
      end if;
    end if;

    if v_motivo is null and v_clave = any (v_vistas) then
      v_motivo := 'Repetida dentro del archivo: mismo cliente y nombre que una fila anterior.';
    elsif v_motivo is null and v_clave = any (v_existentes) then
      v_motivo := 'Ya existe una tienda de ese cliente con el mismo nombre.';
    end if;

    v_vistas := v_vistas || v_clave;

    if v_motivo is not null then
      v_repetidas := v_repetidas || jsonb_build_object('fila', (v_fila->>'fila')::int, 'motivo', v_motivo);
      continue;
    end if;

    v_lat := nullif(v_fila->>'master_lat', '')::double precision;
    v_lng := nullif(v_fila->>'master_lng', '')::double precision;
    if v_lat not between -90 and 90 or v_lng not between -180 and 180 then
      raise exception 'Fila %: coordenadas fuera de rango.', v_fila->>'fila' using errcode = '22023';
    end if;

    insert into public.stores (
      client_id, name, business_channel, estado, municipio, address,
      urbanizacion, ciudad, region, master_lat, master_lng, pdv_code
    ) values (
      v_cliente, btrim(v_fila->>'name'), v_fila->>'business_channel', v_fila->>'estado',
      v_fila->>'municipio', v_fila->>'address',
      nullif(btrim(v_fila->>'urbanizacion'), ''), nullif(btrim(v_fila->>'ciudad'), ''),
      nullif(btrim(v_fila->>'region'), ''), v_lat, v_lng,
      coalesce(v_codigo, public.fn_next_pdv())
    );
    v_insertadas := v_insertadas + 1;
  end loop;

  return jsonb_build_object('insertadas', v_insertadas, 'repetidas', v_repetidas);
end;
$$;

-- ---------------------------------------------------------------------------
-- Duracion de visita
-- ---------------------------------------------------------------------------

alter table public.visits add column if not exists started_at timestamptz;

-- Cambia el tipo de retorno: hay que recrearla. Solo se agrega started_at.
drop function if exists public.fn_mercaderista_detalle(uuid, date, date);
create function public.fn_mercaderista_detalle(p_user_id uuid, p_desde date, p_hasta date)
returns table (
  fecha date, store_id uuid, store_name text, client_name text, resultado text, skip_reason text,
  anomaly_type text[], visit_id uuid, check_in_time timestamptz, started_at timestamptz
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
    coalesce(propia.check_in_time, cub.check_in_time, omit.check_in_time),
    coalesce(propia.started_at, cub.started_at, omit.started_at)
  from en_alcance e
  left join lateral (
    select v.visit_id, v.status, v.anomaly_type, v.check_in_time, v.started_at
    from public.visits v
    where v.user_id = p_user_id
      and v.store_id = e.store_id
      and public.fn_fecha_local(v.check_in_time) = e.route_date
      and v.status <> 'skipped'
    order by v.check_in_time desc
    limit 1
  ) propia on true
  left join lateral (
    select v.visit_id, v.check_in_time, v.started_at
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
    select v.visit_id, v.skip_reason, v.check_in_time, v.started_at
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

-- Mismo acceso que tenia antes de recrearla.
grant execute on function public.fn_mercaderista_detalle(uuid, date, date) to public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Permisos de las funciones nuevas
-- ---------------------------------------------------------------------------

revoke all on function
  public.fn_norm_texto(text),
  public.fn_next_pdv(),
  public.fn_capturar_gps_tienda(uuid, uuid, double precision, double precision, timestamptz),
  public.fn_restaurar_gps_tienda(uuid),
  public.fn_crear_cliente(text, text, text, uuid),
  public.fn_cargar_clientes(jsonb),
  public.fn_cargar_tiendas(jsonb)
from public, anon;

grant execute on function
  public.fn_norm_texto(text),
  public.fn_next_pdv(),
  public.fn_capturar_gps_tienda(uuid, uuid, double precision, double precision, timestamptz),
  public.fn_restaurar_gps_tienda(uuid),
  public.fn_crear_cliente(text, text, text, uuid),
  public.fn_cargar_clientes(jsonb),
  public.fn_cargar_tiendas(jsonb)
to authenticated, service_role;
