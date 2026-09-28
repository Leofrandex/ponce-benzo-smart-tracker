-- Verificación del Bloque 6 (reposiciones). Correr BLOQUE POR BLOQUE:
-- los bloques que deben fallar abortan su transacción. Todo termina en rollback.

-- 1) Backfill: reposiciones de app contra visitas con fecha ≤ hoy (deben coincidir).
select
  (select count(*) from public.restocks where source = 'app') as restocks_app,
  (select count(*) from public.visits where last_restock_date is not null and last_restock_date <= public.fn_hoy()) as visitas_con_fecha;

-- 2) El camino real de la app: el dueño de la visita hace upsert (INSERT … ON CONFLICT DO UPDATE)
--    como authenticated. Re-enviar no falla ni duplica; fecha futura no crea; nula borra.
begin;
select set_config('t.visit', (select visit_id::text from public.visits where last_restock_date is not null order by visit_id limit 1), true);
select set_config('request.jwt.claims', json_build_object('sub',
  (select user_id from public.visits where visit_id = current_setting('t.visit')::uuid),'role','authenticated')::text, true);
set local role authenticated;
insert into public.visits (visit_id, session_id, store_id, user_id, check_in_time, status, last_restock_date)
  select visit_id, session_id, store_id, user_id, check_in_time, status, last_restock_date
  from public.visits where visit_id = current_setting('t.visit')::uuid
on conflict (visit_id) do update set last_restock_date = excluded.last_restock_date;
reset role;
select count(*) as debe_ser_1 from public.restocks where restock_id = current_setting('t.visit')::uuid;
update public.visits set last_restock_date = public.fn_hoy() + 3 where visit_id = current_setting('t.visit')::uuid;
select count(*) as debe_ser_0_tras_futura from public.restocks where restock_id = current_setting('t.visit')::uuid;
update public.visits set last_restock_date = public.fn_hoy() where visit_id = current_setting('t.visit')::uuid;
select count(*) as debe_ser_1_tras_hoy from public.restocks where restock_id = current_setting('t.visit')::uuid;
update public.visits set last_restock_date = null where visit_id = current_setting('t.visit')::uuid;
select count(*) as debe_ser_0_tras_nula from public.restocks where restock_id = current_setting('t.visit')::uuid;
rollback;

-- 3a) Admin (Diego) registra con 2 productos (uno repetido y un NULL se ignoran) y nota recortada.
begin;
select set_config('request.jwt.claims', json_build_object('sub',(select id from public.users where email='dmori@ponce-benzo.com'),'role','authenticated')::text, true);
set local role authenticated;
select set_config('t.nuevo', public.fn_registrar_reposicion(
  (select store_id from public.stores order by store_id limit 1), public.fn_hoy(),
  (select array_agg(product_id) || array[(select min(product_id::text)::uuid from public.products), null::uuid]
     from (select product_id from public.products order by product_id limit 2) p),
  '  prueba  ')::text, true);
select source, note as debe_ser_prueba,
  (select count(*) from public.restock_products rp where rp.restock_id = r.restock_id) as debe_ser_2
  from public.restocks r where r.restock_id = current_setting('t.nuevo')::uuid;
rollback;

-- 3b) Fecha futura: debe fallar con fecha_futura.
begin;
select set_config('request.jwt.claims', json_build_object('sub',(select id from public.users where email='dmori@ponce-benzo.com'),'role','authenticated')::text, true);
set local role authenticated;
select public.fn_registrar_reposicion((select store_id from public.stores order by store_id limit 1), public.fn_hoy() + 1, '{}', null);
rollback;

-- 4a) Vendedor en una tienda que SÍ atiende: debe funcionar.
begin;
select set_config('t.vend', (select ca.user_id::text from public.client_assignments ca
  join public.users u on u.id = ca.user_id where u.role = 'vendedor' and u.active order by ca.user_id limit 1), true);
select set_config('t.propia', (select s.store_id::text from public.stores s join public.client_assignments ca on ca.client_id = s.client_id
  where ca.user_id = current_setting('t.vend')::uuid order by s.store_id limit 1), true);
select set_config('t.ajena', (select s.store_id::text from public.stores s where s.client_id is not null and not exists (
  select 1 from public.client_assignments ca where ca.client_id = s.client_id and ca.user_id = current_setting('t.vend')::uuid)
  order by s.store_id limit 1), true);
select current_setting('t.vend') as vendedor, current_setting('t.propia') as tienda_propia, current_setting('t.ajena') as tienda_ajena; -- ninguna vacía
select set_config('request.jwt.claims', json_build_object('sub',current_setting('t.vend'),'role','authenticated')::text, true);
set local role authenticated;
select public.fn_registrar_reposicion(current_setting('t.propia')::uuid, public.fn_hoy(), '{}', null) as ok_propia;
rollback;

-- 4b) El mismo vendedor en una tienda que NO atiende: debe fallar por row-level security.
--     (Repite los set_config de 4a: cada bloque es su propia transacción.)
begin;
select set_config('t.vend', (select ca.user_id::text from public.client_assignments ca
  join public.users u on u.id = ca.user_id where u.role = 'vendedor' and u.active order by ca.user_id limit 1), true);
select set_config('t.ajena', (select s.store_id::text from public.stores s where s.client_id is not null and not exists (
  select 1 from public.client_assignments ca where ca.client_id = s.client_id and ca.user_id = current_setting('t.vend')::uuid)
  order by s.store_id limit 1), true);
select current_setting('t.ajena') as tienda_ajena_no_vacia;
select set_config('request.jwt.claims', json_build_object('sub',current_setting('t.vend'),'role','authenticated')::text, true);
set local role authenticated;
select public.fn_registrar_reposicion(current_setting('t.ajena')::uuid, public.fn_hoy(), '{}', null);
rollback;
