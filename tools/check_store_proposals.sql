-- Verificación Sucursales nuevas. Correr BLOQUE POR BLOQUE: los bloques que
-- deben fallar abortan su transacción. Todo termina en rollback.

-- 1) Mercaderista inserta la suya y solo ve las suyas.
begin;
select set_config('request.jwt.claims', json_build_object('sub',(select id from public.users where role='merchandiser' and active limit 1),'role','authenticated')::text, true);
set local role authenticated;
insert into public.store_proposals (proposal_id, user_id, name, lat, lng, accuracy_m, captured_at)
values ('00000000-0000-4000-8000-000000000001', auth.uid(), 'Prueba Farmacia X', 10.49, -66.85, 12, now());
select count(*) = (select count(*) from public.store_proposals where user_id = auth.uid()) as debe_ser_true
from public.store_proposals;
-- Reintento del sync: upsert sobre la propia fila pendiente NO falla.
insert into public.store_proposals (proposal_id, user_id, name, lat, lng, accuracy_m, captured_at)
values ('00000000-0000-4000-8000-000000000001', auth.uid(), 'Prueba Farmacia X', 10.49, -66.85, 12, now())
on conflict (proposal_id) do update set name = excluded.name;
select 'ok_reintento' as debe_verse;
rollback;

-- 2) Mercaderista NO puede autoaprobarse (debe FALLAR: new row violates row-level security).
begin;
select set_config('request.jwt.claims', json_build_object('sub',(select id from public.users where role='merchandiser' and active limit 1),'role','authenticated')::text, true);
set local role authenticated;
insert into public.store_proposals (proposal_id, user_id, name, lat, lng, captured_at)
values ('00000000-0000-4000-8000-000000000002', auth.uid(), 'Prueba', 10.49, -66.85, now());
update public.store_proposals set status = 'aprobada' where proposal_id = '00000000-0000-4000-8000-000000000002';
rollback;

-- 3) Mercaderista NO puede aprobar por RPC (debe FALLAR: solo_admin).
begin;
select set_config('request.jwt.claims', json_build_object('sub',(select id from public.users where role='merchandiser' and active limit 1),'role','authenticated')::text, true);
set local role authenticated;
insert into public.store_proposals (proposal_id, user_id, name, lat, lng, captured_at)
values ('00000000-0000-4000-8000-000000000003', auth.uid(), 'Prueba', 10.49, -66.85, now());
select public.fn_aprobar_propuesta('00000000-0000-4000-8000-000000000003', '{"name":"Prueba","master_lat":10.49,"master_lng":-66.85}');
rollback;

-- 4) Admin aprueba: crea la tienda y cierra la propuesta. Aprobar dos veces FALLA (propuesta_ya_revisada).
begin;
insert into public.store_proposals (proposal_id, user_id, name, lat, lng, captured_at)
values ('00000000-0000-4000-8000-000000000004', (select id from public.users where role='merchandiser' and active limit 1), 'Prueba Aprobar', 10.49, -66.85, now());
select set_config('request.jwt.claims', json_build_object('sub',(select id from public.users where email='dmori@ponce-benzo.com'),'role','authenticated')::text, true);
set local role authenticated;
select public.fn_aprobar_propuesta('00000000-0000-4000-8000-000000000004',
  '{"name":"Prueba Aprobar","address":"Av. X","master_lat":10.4901,"master_lng":-66.8502,"business_channel":"farmacia","classification":"B"}') as store_id_nuevo;
select status = 'aprobada' and store_id is not null and reviewed_by = auth.uid() as debe_ser_true
from public.store_proposals where proposal_id = '00000000-0000-4000-8000-000000000004';
select s.master_lat = 10.4901 and s.business_channel = 'farmacia' as debe_ser_true
from public.stores s join public.store_proposals p on p.store_id = s.store_id
where p.proposal_id = '00000000-0000-4000-8000-000000000004';
select public.fn_aprobar_propuesta('00000000-0000-4000-8000-000000000004', '{"name":"Otra vez","master_lat":10.49,"master_lng":-66.85}'); -- FALLA
rollback;

-- 5) Admin rechaza como duplicada y corrige el GPS de la tienda existente.
begin;
insert into public.store_proposals (proposal_id, user_id, name, lat, lng, captured_at)
values ('00000000-0000-4000-8000-000000000005', (select id from public.users where role='merchandiser' and active limit 1), 'Dup', 10.123456, -66.654321, now());
select set_config('request.jwt.claims', json_build_object('sub',(select id from public.users where email='dmori@ponce-benzo.com'),'role','authenticated')::text, true);
set local role authenticated;
select public.fn_rechazar_propuesta('00000000-0000-4000-8000-000000000005', 'Duplicada', (select store_id from public.stores where active limit 1), 10.123456, -66.654321);
select p.status = 'rechazada' and s.master_lat = 10.123456 and s.master_lng = -66.654321 as debe_ser_true
from public.store_proposals p join public.stores s on s.store_id = p.store_id
where p.proposal_id = '00000000-0000-4000-8000-000000000005';
rollback;

-- 6) Tiendas cercanas: un punto encima de una tienda la devuelve a ~0 m.
begin;
select set_config('request.jwt.claims', json_build_object('sub',(select id from public.users where email='dmori@ponce-benzo.com'),'role','authenticated')::text, true);
set local role authenticated;
with t as (select store_id, master_lat, master_lng from public.stores where active limit 1)
select c.store_id = t.store_id and c.distancia_m < 1 as debe_ser_true
from t, public.fn_tiendas_cercanas(t.master_lat, t.master_lng, 100) c
order by c.distancia_m limit 1;
rollback;
