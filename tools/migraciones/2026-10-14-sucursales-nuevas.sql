-- ============================================================
-- Migración 2026-10-14 — Sucursales nuevas registradas desde la app.
-- Spec: docs/superpowers/specs/2026-10-14-sucursales-nuevas-gps-design.md
-- Aplicar con el OK de Sebastián. Idempotente.
-- ============================================================

create table if not exists public.store_proposals (
  proposal_id   uuid primary key,
  user_id       uuid not null default auth.uid() references public.users(id),
  name          text not null check (length(trim(name)) > 0),
  client_id     uuid references public.clients(client_id) on delete set null,
  note          text,
  photo_urls    text[] not null default '{}',
  lat           double precision not null check (lat between -90 and 90),
  lng           double precision not null check (lng between -180 and 180),
  accuracy_m    real,
  captured_at   timestamptz not null,
  created_at    timestamptz not null default now(),
  status        text not null default 'pendiente' check (status in ('pendiente','aprobada','rechazada')),
  store_id      uuid references public.stores(store_id) on delete set null,
  reject_reason text,
  reviewed_by   uuid references public.users(id),
  reviewed_at   timestamptz
);
create index if not exists idx_store_proposals_status on public.store_proposals(status);

alter table public.store_proposals enable row level security;

-- Cualquier usuario activo registra propuestas propias, siempre pendientes.
drop policy if exists store_proposals_insert_own on public.store_proposals;
create policy store_proposals_insert_own on public.store_proposals
  for insert to authenticated
  with check (
    user_id = auth.uid() and status = 'pendiente' and store_id is null
    and reviewed_by is null and reviewed_at is null and reject_reason is null
    and exists (select 1 from public.users u where u.id = auth.uid() and u.active)
  );

-- El autor ve las suyas; el admin, todas.
drop policy if exists store_proposals_select on public.store_proposals;
create policy store_proposals_select on public.store_proposals
  for select to authenticated
  using (user_id = auth.uid() or public.fn_is_admin());

-- El sync del teléfono reintenta con upsert y luego completa photo_urls:
-- el autor puede actualizar SU propuesta mientras siga pendiente, sin cerrarla.
drop policy if exists store_proposals_update_own_pending on public.store_proposals;
create policy store_proposals_update_own_pending on public.store_proposals
  for update to authenticated
  using (user_id = auth.uid() and status = 'pendiente')
  with check (
    user_id = auth.uid() and status = 'pendiente' and store_id is null
    and reviewed_by is null and reviewed_at is null and reject_reason is null
  );

drop policy if exists store_proposals_update_admin on public.store_proposals;
create policy store_proposals_update_admin on public.store_proposals
  for update to authenticated
  using (public.fn_is_admin()) with check (public.fn_is_admin());

-- Aprobar: crea la tienda y cierra la propuesta en una sola transacción.
-- SECURITY INVOKER: el insert en stores pasa por stores_insert_staff (admin).
create or replace function public.fn_aprobar_propuesta(p_proposal_id uuid, p_store jsonb)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_status text;
  v_store_id uuid;
  v_lat double precision := (p_store->>'master_lat')::double precision;
  v_lng double precision := (p_store->>'master_lng')::double precision;
begin
  if not public.fn_is_admin() then raise exception 'solo_admin'; end if;
  if coalesce(trim(p_store->>'name'), '') = '' then raise exception 'nombre_requerido'; end if;
  if v_lat is null or v_lng is null or v_lat not between -90 and 90 or v_lng not between -180 and 180 then
    raise exception 'coordenadas_invalidas';
  end if;

  select status into v_status from public.store_proposals
   where proposal_id = p_proposal_id for update;
  if v_status is distinct from 'pendiente' then raise exception 'propuesta_ya_revisada'; end if;

  insert into public.stores (name, address, master_lat, master_lng, estado, municipio, urbanizacion,
                             ciudad, region, business_channel, classification, client_id, active)
  values (
    trim(p_store->>'name'), nullif(trim(p_store->>'address'), ''), v_lat, v_lng,
    nullif(p_store->>'estado', ''), nullif(p_store->>'municipio', ''), nullif(p_store->>'urbanizacion', ''),
    nullif(p_store->>'ciudad', ''), nullif(p_store->>'region', ''),
    nullif(p_store->>'business_channel', ''), nullif(p_store->>'classification', ''),
    nullif(p_store->>'client_id', '')::uuid, true
  )
  returning store_id into v_store_id;

  update public.store_proposals
     set status = 'aprobada', store_id = v_store_id, reviewed_by = auth.uid(), reviewed_at = now()
   where proposal_id = p_proposal_id;
  return v_store_id;
end $$;

-- Rechazar, opcionalmente como duplicada de una tienda existente y corrigiendo su GPS.
drop function if exists public.fn_rechazar_propuesta(uuid, text, uuid, boolean);
create or replace function public.fn_rechazar_propuesta(
  p_proposal_id uuid, p_reason text, p_duplicate_of uuid default null,
  p_fix_lat double precision default null, p_fix_lng double precision default null
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_status text;
begin
  if not public.fn_is_admin() then raise exception 'solo_admin'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'motivo_requerido'; end if;

  select status into v_status from public.store_proposals
   where proposal_id = p_proposal_id for update;
  if v_status is distinct from 'pendiente' then raise exception 'propuesta_ya_revisada'; end if;

  if p_duplicate_of is not null and p_fix_lat is not null and p_fix_lng is not null then
    if p_fix_lat not between -90 and 90 or p_fix_lng not between -180 and 180 then
      raise exception 'coordenadas_invalidas';
    end if;
    update public.stores set master_lat = p_fix_lat, master_lng = p_fix_lng where store_id = p_duplicate_of;
  end if;

  update public.store_proposals
     set status = 'rechazada', reject_reason = trim(p_reason), store_id = p_duplicate_of,
         reviewed_by = auth.uid(), reviewed_at = now()
   where proposal_id = p_proposal_id;
end $$;

-- Tiendas activas a menos de p_radio_m metros de un punto (para detectar duplicados).
create or replace function public.fn_tiendas_cercanas(p_lat double precision, p_lng double precision, p_radio_m double precision default 100)
returns table(store_id uuid, name text, address text, master_lat double precision, master_lng double precision, distancia_m double precision)
language sql stable security invoker set search_path = '' as $$
  with p as (select public.st_setsrid(public.st_makepoint(p_lng, p_lat), 4326)::public.geography as g)
  select s.store_id, s.name, s.address, s.master_lat, s.master_lng,
         public.st_distance(s.master_location, p.g) as distancia_m
    from public.stores s, p
   where s.active and public.st_dwithin(s.master_location, p.g, p_radio_m)
   order by distancia_m;
$$;

grant execute on function public.fn_aprobar_propuesta(uuid, jsonb) to authenticated;
grant execute on function public.fn_rechazar_propuesta(uuid, text, uuid, double precision, double precision) to authenticated;
grant execute on function public.fn_tiendas_cercanas(double precision, double precision, double precision) to authenticated;

revoke execute on function public.fn_aprobar_propuesta(uuid, jsonb) from public, anon;
revoke execute on function public.fn_rechazar_propuesta(uuid, text, uuid, double precision, double precision) from public, anon;
revoke execute on function public.fn_tiendas_cercanas(double precision, double precision, double precision) from public, anon;
