-- Verificación del Bloque 6. Cada bloque termina en rollback.

-- 1) Backfill: cuántas reposiciones de app hay contra visitas con fecha ≤ hoy (deben coincidir).
select
  (select count(*) from public.restocks where source = 'app') as restocks_app,
  (select count(*) from public.visits where last_restock_date is not null and last_restock_date <= public.fn_hoy()) as visitas_con_fecha;

-- 2) Trigger: re-enviar la misma visita no duplica; fecha futura no crea; nula borra.
begin;
with v as (select visit_id from public.visits where last_restock_date is not null limit 1)
update public.visits set last_restock_date = last_restock_date where visit_id = (select visit_id from v);
select count(*) as debe_ser_1 from public.restocks r join public.visits v on v.visit_id = r.restock_id
  where v.visit_id = (select visit_id from public.visits where last_restock_date is not null limit 1);
update public.visits set last_restock_date = public.fn_hoy() + 3
  where visit_id = (select visit_id from public.visits where last_restock_date is not null limit 1);
select count(*) as debe_ser_0_tras_futura from public.restocks r
  where r.restock_id = (select visit_id from public.visits where last_restock_date = public.fn_hoy() + 3 limit 1);
rollback;

-- 3) Admin (Diego) registra con productos; fecha futura falla.
begin;
select set_config('request.jwt.claims', json_build_object('sub',(select id from public.users where email='dmori@ponce-benzo.com'),'role','authenticated')::text, true);
set local role authenticated;
select public.fn_registrar_reposicion(
  (select store_id from public.stores limit 1), public.fn_hoy(),
  array(select product_id from public.products limit 2), '  prueba  ') as nuevo_id;
select source, note, (select count(*) from public.restock_products rp where rp.restock_id = r.restock_id) as productos
  from public.restocks r where r.source = 'panel' order by created_at desc limit 1;
rollback;

begin;
select set_config('request.jwt.claims', json_build_object('sub',(select id from public.users where email='dmori@ponce-benzo.com'),'role','authenticated')::text, true);
set local role authenticated;
select public.fn_registrar_reposicion((select store_id from public.stores limit 1), public.fn_hoy() + 1, '{}', null); -- debe fallar: fecha_futura
rollback;

-- 4) Vendedor en una tienda que NO atiende: debe fallar por RLS.
begin;
select set_config('request.jwt.claims', json_build_object('sub',
  (select u.id from public.users u where u.role = 'vendedor' and u.active limit 1),'role','authenticated')::text, true);
set local role authenticated;
select public.fn_registrar_reposicion(
  (select s.store_id from public.stores s where not exists (
     select 1 from public.client_assignments ca
     where ca.client_id = s.client_id
       and ca.user_id = (select u.id from public.users u where u.role = 'vendedor' and u.active limit 1)) limit 1),
  public.fn_hoy(), '{}', null); -- debe fallar: row-level security
rollback;
