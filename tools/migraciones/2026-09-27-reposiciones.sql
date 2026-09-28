-- ============================================================
-- Migración 2026-09-27 — reposiciones (Bloque 6)
--
-- Aplicar en el SQL editor de Supabase (producción), con el OK del usuario.
-- Idempotente: se puede correr dos veces.
--
-- restocks guarda cada reposición de una tienda. Las que vienen de la app
-- se derivan de visits.last_restock_date con un trigger (restock_id =
-- visit_id), así la app actual no cambia. Las del panel se registran con
-- fn_registrar_reposicion, que inserta la reposición y sus productos en
-- una sola transacción y con RLS aplicada.
-- ============================================================

create table if not exists public.restocks (
  restock_id    uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores(store_id),
  restock_date  date not null,
  source        text not null check (source in ('app','panel')),
  visit_id      uuid null references public.visits(visit_id) on delete cascade,
  created_by    uuid null references public.users(id) on delete set null,
  note          text null,
  created_at    timestamptz not null default now(),
  check (source = 'panel' or visit_id is not null)
);
create index if not exists idx_restocks_store_date on public.restocks(store_id, restock_date desc);
create index if not exists idx_restocks_visit on public.restocks(visit_id);
alter table public.restocks enable row level security;

create table if not exists public.restock_products (
  restock_id  uuid not null references public.restocks(restock_id) on delete cascade,
  product_id  uuid not null references public.products(product_id),
  primary key (restock_id, product_id)
);
create index if not exists idx_restock_products_product on public.restock_products(product_id);
alter table public.restock_products enable row level security;

-- Ojo (Bloque 7): una fecha nula borra la reposición y, en cascada, sus productos.
-- Copia visits.last_restock_date a restocks. SECURITY DEFINER porque el
-- mercaderista no tiene permiso de escribir restocks. Nunca lanza: una fecha
-- nula o futura (reloj del teléfono adelantado) simplemente no crea reposición.
create or replace function public.fn_sync_restock_from_visit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.last_restock_date is null or new.last_restock_date > public.fn_hoy() then
    delete from public.restocks where restock_id = new.visit_id and source = 'app';
    return new;
  end if;
  insert into public.restocks (restock_id, store_id, restock_date, source, visit_id, created_by)
  values (new.visit_id, new.store_id, new.last_restock_date, 'app', new.visit_id, new.user_id)
  on conflict (restock_id) do update
    set store_id = excluded.store_id,
        restock_date = excluded.restock_date,
        created_by = excluded.created_by;
  return new;
end;
$$;
revoke execute on function public.fn_sync_restock_from_visit() from public, anon, authenticated;

drop trigger if exists trg_visit_restock on public.visits;
create trigger trg_visit_restock
  after insert or update of last_restock_date, store_id on public.visits
  for each row execute function public.fn_sync_restock_from_visit();

-- Backfill: una reposición por cada visita que ya trae fecha (sin productos).
insert into public.restocks (restock_id, store_id, restock_date, source, visit_id, created_by)
select v.visit_id, v.store_id, v.last_restock_date, 'app', v.visit_id, v.user_id
from public.visits v
where v.last_restock_date is not null and v.last_restock_date <= public.fn_hoy()
on conflict (restock_id) do nothing;

-- ── RLS (habilitada junto a cada create table) ───────────────

drop policy if exists restocks_read on public.restocks;
create policy restocks_read on public.restocks
  for select to authenticated using (public.fn_can_see_store(store_id));

drop policy if exists restocks_insert_panel on public.restocks;
create policy restocks_insert_panel on public.restocks
  for insert to authenticated with check (
    source = 'panel'
    and created_by = auth.uid()
    and restock_date <= public.fn_hoy()
    and public.fn_can_see_store(store_id)
    and exists (select 1 from public.users u
                where u.id = auth.uid() and u.role in ('admin','vendedor') and u.active)
  );

drop policy if exists restocks_delete on public.restocks;
create policy restocks_delete on public.restocks
  for delete to authenticated using (
    public.fn_is_admin() or (source = 'panel' and created_by = auth.uid())
  );

drop policy if exists restock_products_read on public.restock_products;
create policy restock_products_read on public.restock_products
  for select to authenticated using (
    exists (select 1 from public.restocks r where r.restock_id = restock_products.restock_id)
    or exists (select 1 from public.visits v
               where v.visit_id = restock_products.restock_id and v.user_id = auth.uid())
  );

-- Panel: el autor de la reposición. App (Bloque 7): el dueño de la visita.
drop policy if exists restock_products_insert on public.restock_products;
create policy restock_products_insert on public.restock_products
  for insert to authenticated with check (
    exists (select 1 from public.restocks r
            where r.restock_id = restock_products.restock_id
              and r.source = 'panel' and r.created_by = auth.uid())
    or exists (select 1 from public.visits v
               where v.visit_id = restock_products.restock_id and v.user_id = auth.uid())
  );

-- ── Registro desde el panel ──────────────────────────────────
-- SECURITY INVOKER: las políticas de arriba deciden quién puede.
create or replace function public.fn_registrar_reposicion(
  p_store_id uuid, p_fecha date, p_productos uuid[], p_nota text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_fecha is null or p_fecha > public.fn_hoy() then
    raise exception 'fecha_futura' using errcode = '22023';
  end if;
  insert into public.restocks (store_id, restock_date, source, created_by, note)
  values (p_store_id, p_fecha, 'panel', auth.uid(), nullif(btrim(p_nota), ''))
  returning restock_id into v_id;
  insert into public.restock_products (restock_id, product_id)
  select distinct v_id, x from unnest(coalesce(p_productos, '{}'::uuid[])) as x where x is not null;
  return v_id;
end;
$$;
revoke execute on function public.fn_registrar_reposicion(uuid, date, uuid[], text) from public, anon;
grant execute on function public.fn_registrar_reposicion(uuid, date, uuid[], text) to authenticated;
