-- 2026-10-26 — El reporte suelto (ADR-007/ADR-008) crea desde la app la ruta
-- especial del dia (adhocRoute.ts: insert, y update de store_ids al sumar
-- tiendas). `routes` solo tenia politicas SELECT, asi que el insert lo
-- rechazaba RLS y la app mostraba "No se pudo abrir el reporte". Nunca se
-- llego a crear una ruta especial en produccion.
--
-- Alcance minimo: cada quien escribe SOLO sus rutas especiales, y solo si la
-- app le muestra la pestana Reporte (supervisor o colaborador, MainTabs.tsx).
-- Las rutas normales siguen escribiendose unicamente con service role.

create or replace function public.fn_can_report_adhoc()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and active and (is_supervisor or role = 'colaborador')
  );
$$;

revoke all on function public.fn_can_report_adhoc() from public;
grant execute on function public.fn_can_report_adhoc() to authenticated;

drop policy if exists "routes_special_insert_own" on public.routes;
create policy "routes_special_insert_own" on public.routes
  for insert to authenticated
  with check (user_id = auth.uid() and is_special and public.fn_can_report_adhoc());

drop policy if exists "routes_special_update_own" on public.routes;
create policy "routes_special_update_own" on public.routes
  for update to authenticated
  using (user_id = auth.uid() and is_special and public.fn_can_report_adhoc())
  with check (user_id = auth.uid() and is_special and public.fn_can_report_adhoc());
