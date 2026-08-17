-- ============================================================
-- Ponzivenzo Smart Tracker — Supabase Schema v2.0 (consolidado)
-- Proyecto creado DESDE CERO — sin datos previos que migrar.
-- Idempotente: re-ejecutable sin errores.
-- Correr en: Supabase Dashboard → SQL Editor (o MCP apply_migration)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: clients (cadena comercial — dueña de varias sucursales)
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
  client_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL UNIQUE,
  business_channel TEXT
    CHECK (business_channel IN ('drogueria','farmacia','supermercado','autoservicio','mayorista','otro')),
  active           BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clients_select ON clients;
-- clients_select se define más abajo, después de fn_my_client_ids()/fn_is_merchandiser()
-- (alcance por cliente asignado).

-- ============================================================
-- TABLE: stores (maestro de tiendas + segmentación CRM)
-- ============================================================
CREATE TABLE IF NOT EXISTS stores (
  store_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL,
  address          TEXT,
  master_lat       DOUBLE PRECISION NOT NULL,
  master_lng       DOUBLE PRECISION NOT NULL,
  master_location  GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(master_lng, master_lat), 4326)::geography
  ) STORED,
  estado           TEXT,
  municipio        TEXT,
  urbanizacion     TEXT,
  business_channel TEXT
    CHECK (business_channel IN ('drogueria','farmacia','supermercado','autoservicio','mayorista','otro')),
  classification   TEXT CHECK (classification IN ('A','B','C')),
  client_id        UUID REFERENCES clients(client_id) ON DELETE SET NULL,
  ciudad           TEXT,
  region           TEXT,
  active           BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stores_estado         ON stores(estado);
CREATE INDEX IF NOT EXISTS idx_stores_client         ON stores(client_id);
CREATE INDEX IF NOT EXISTS idx_stores_channel        ON stores(business_channel);
CREATE INDEX IF NOT EXISTS idx_stores_classification ON stores(classification);
CREATE INDEX IF NOT EXISTS idx_stores_location ON stores USING GIST (master_location);

-- ============================================================
-- TABLE: users (perfiles vinculados a Supabase Auth + jerarquía)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'merchandiser' CHECK (role IN ('merchandiser','vendedor','admin')),
  supervisor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_supervisor ON users(supervisor_id);

-- ============================================================
-- TABLE: client_assignments (alcance por cliente — qué clientes ve cada usuario)
-- ============================================================
create table public.client_assignments (
  user_id    uuid not null references public.users(id) on delete cascade,
  client_id  uuid not null references public.clients(client_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, client_id)
);

create index client_assignments_user_idx on public.client_assignments(user_id);

-- ============================================================
-- RPC: reemplazar TODO el conjunto de client_assignments en una transaccion
-- atomica (siembra desde el Excel de asesores). borrado+insercion en dos
-- llamadas separadas puede fallar a medias y dejar la tabla vacia, lo que
-- con RLS activo significa que todos los vendedores ven cero. Rechaza un
-- conjunto vacio como ultima defensa contra un Excel mal leido.
-- SECURITY DEFINER + revoke total: solo la invoca el script con service role.
-- ============================================================
create or replace function public.fn_replace_client_assignments(p_filas jsonb)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_n integer;
begin
  if p_filas is null or jsonb_array_length(p_filas) = 0 then
    raise exception 'fn_replace_client_assignments: se recibio un conjunto vacio; abortado para no dejar a todos sin cartera';
  end if;

  delete from public.client_assignments where true;

  insert into public.client_assignments (user_id, client_id)
  select (f->>'user_id')::uuid, (f->>'client_id')::uuid
  from jsonb_array_elements(p_filas) f;

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke execute on function public.fn_replace_client_assignments(jsonb) from public, anon, authenticated;

-- ============================================================
-- TABLE: contacts (varios contactos por tienda — CRM)
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
  contact_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id    UUID NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  role_title  TEXT,
  phone       TEXT,
  email       TEXT,
  birthday    DATE,
  is_primary  BOOLEAN DEFAULT FALSE,
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contacts_store ON contacts(store_id);
-- Encargado único: a lo sumo UN contacto primario activo por tienda (garantía a nivel BD)
CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_primary_per_store
  ON contacts(store_id) WHERE (is_primary AND active);

-- ============================================================
-- TABLE: contact_engagements (bitácora estructurada: notas + to-dos)
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_engagements (
  engagement_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id       UUID NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
  contact_id     UUID REFERENCES contacts(contact_id) ON DELETE SET NULL,
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type           TEXT NOT NULL CHECK (type IN ('note','todo')),
  body           TEXT NOT NULL,
  status         TEXT CHECK (status IN ('open','done')),
  due_date       DATE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_engagements_store   ON contact_engagements(store_id);
CREATE INDEX IF NOT EXISTS idx_engagements_contact ON contact_engagements(contact_id);

-- ============================================================
-- TABLE: routes (asignación de ruta diaria)
-- ============================================================
CREATE TABLE IF NOT EXISTS routes (
  route_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  route_date DATE NOT NULL,
  store_ids  UUID[] NOT NULL,  -- lista ordenada de tiendas del día
  is_special BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, route_date)
);

-- ============================================================
-- TABLE: sessions (jornadas de ruta)
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  session_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  route_id       UUID NOT NULL REFERENCES routes(route_id) ON DELETE CASCADE,
  session_start  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_end    TIMESTAMPTZ,
  start_location JSONB NOT NULL,  -- { lat, lng }
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: location_pings (NUEVA v2.0 — tracking GPS en background)
-- ============================================================
CREATE TABLE IF NOT EXISTS location_pings (
  ping_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(session_id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  timestamp  TIMESTAMPTZ NOT NULL,
  lat        DOUBLE PRECISION NOT NULL,
  lng        DOUBLE PRECISION NOT NULL,
  location   GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pings_session   ON location_pings(session_id);
CREATE INDEX IF NOT EXISTS idx_pings_user_time ON location_pings(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_pings_location ON location_pings USING GIST (location);

-- ============================================================
-- TABLE: visits (check-ins en tienda)
-- ============================================================
CREATE TABLE IF NOT EXISTS visits (
  visit_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id        UUID NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  store_id          UUID NOT NULL REFERENCES stores(store_id) ON DELETE RESTRICT,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  check_in_time     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_in_location JSONB,         -- { lat, lng }
  photo_urls        TEXT[] DEFAULT '{}',
  observations      TEXT,
  status            TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','skipped','anomaly')),
  anomaly_type      TEXT[] CHECK (anomaly_type IS NULL OR anomaly_type <@ ARRAY['sin_stock','cambio_planograma','diferencia_precios','producto_danado','otro']::TEXT[]),
  skip_reason       TEXT CHECK (skip_reason IN ('fuera_de_ruta','sin_acceso','otro')),
  last_restock_date DATE,
  synced            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_visits_session      ON visits(session_id);
CREATE INDEX IF NOT EXISTS idx_visits_store        ON visits(store_id);
CREATE INDEX IF NOT EXISTS idx_visits_synced       ON visits(synced) WHERE synced = FALSE;
CREATE INDEX IF NOT EXISTS idx_visits_last_restock ON visits(store_id, last_restock_date);

-- ============================================================
-- TABLE: tasks (v2.0: status open/resolved + description)
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  task_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignee_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  store_id           UUID REFERENCES stores(store_id) ON DELETE SET NULL,
  source_visit_id    UUID REFERENCES visits(visit_id) ON DELETE SET NULL,
  task_type          TEXT NOT NULL,
  title              TEXT,
  description        TEXT,  -- v2.0: detalle/contexto (el trigger copia visits.observations)
  status             TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  resolved_at        TIMESTAMPTZ,  -- §1.6 spec: cuándo se resolvió la tarea
  resolved_by        UUID REFERENCES users(id)  -- §1.6 spec: quién la resolvió
);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_store    ON tasks(store_id);

-- ── Generación automática de tareas desde anomalías ──
CREATE OR REPLACE FUNCTION fn_task_type_from_anomaly(p_anomaly TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_anomaly
    WHEN 'sin_stock'          THEN 'reponer_stock'
    WHEN 'cambio_planograma'  THEN 'contactar_comprador'
    WHEN 'diferencia_precios' THEN 'contactar_comprador'
    WHEN 'producto_danado'    THEN 'contactar_gerente'
    ELSE 'revisar_anomalia'
  END;
$$;

-- INVARIANTE: el cliente debe escribir status='anomaly' y anomaly_type en el MISMO INSERT
-- (regla "Payload Completa"). El trigger lee NEW.anomaly_type/NEW.observations en el AFTER INSERT.
-- SECURITY DEFINER: el lookup del supervisor y el INSERT en tasks no dependen del RLS del caller.
CREATE OR REPLACE FUNCTION fn_create_task_from_anomaly()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_supervisor UUID;
  v_anomaly    TEXT;
  v_title      TEXT;
BEGIN
  IF NEW.status = 'anomaly' AND NEW.anomaly_type IS NOT NULL THEN
    SELECT supervisor_id INTO v_supervisor FROM public.users WHERE id = NEW.user_id;
    FOREACH v_anomaly IN ARRAY NEW.anomaly_type LOOP
      v_title := 'Anomalía: ' || v_anomaly;
      IF NOT EXISTS (
        SELECT 1 FROM public.tasks
        WHERE source_visit_id = NEW.visit_id AND title = v_title
      ) THEN
        INSERT INTO public.tasks
          (assignee_user_id, created_by_user_id, store_id, source_visit_id, task_type, title, description, status)
        VALUES (
          v_supervisor, NEW.user_id, NEW.store_id, NEW.visit_id,
          public.fn_task_type_from_anomaly(v_anomaly),
          v_title, NEW.observations, 'open'
        );
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_visit_anomaly_task ON visits;
CREATE TRIGGER trg_visit_anomaly_task
  AFTER INSERT OR UPDATE OF status ON visits
  FOR EACH ROW EXECUTE FUNCTION fn_create_task_from_anomaly();

-- Hardening: las funciones internas no deben ser ejecutables vía RPC por clientes
REVOKE EXECUTE ON FUNCTION public.fn_create_task_from_anomaly() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_task_type_from_anomaly(TEXT) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- TABLE: visit_anomaly_products (puente visita/anomalía <-> productos afectados)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.visit_anomaly_products (
  visit_id     UUID NOT NULL REFERENCES public.visits(visit_id) ON DELETE CASCADE,
  anomaly_type TEXT NOT NULL CHECK (anomaly_type IN
    ('sin_stock','cambio_planograma','diferencia_precios','producto_danado','otro')),
  product_id   UUID NOT NULL REFERENCES public.products(product_id) ON DELETE RESTRICT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (visit_id, anomaly_type, product_id)
);
CREATE INDEX IF NOT EXISTS idx_vap_product ON public.visit_anomaly_products(product_id);

CREATE OR REPLACE FUNCTION public.fn_vap_validate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.visits v
    WHERE v.visit_id = NEW.visit_id
      AND v.anomaly_type IS NOT NULL
      AND NEW.anomaly_type = ANY(v.anomaly_type)
  ) THEN
    RAISE EXCEPTION 'anomaly_type % no pertenece a la visita %', NEW.anomaly_type, NEW.visit_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fn_vap_validate() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_vap_validate ON public.visit_anomaly_products;
CREATE TRIGGER trg_vap_validate
  BEFORE INSERT OR UPDATE ON public.visit_anomaly_products
  FOR EACH ROW EXECUTE FUNCTION public.fn_vap_validate();

ALTER TABLE public.visit_anomaly_products ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TABLE: competitor_brands (lookup editable de marcas competidoras)
-- ============================================================
CREATE TABLE IF NOT EXISTS competitor_brands (
  brand_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name     TEXT NOT NULL UNIQUE,
  active   BOOLEAN DEFAULT TRUE
);
INSERT INTO competitor_brands (name) VALUES ('Genérico / Sin marca')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- TABLE: products (catálogo de SKUs de la empresa)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.products (
  product_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku        TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  brand      TEXT,
  ean13      TEXT,
  ean14      TEXT,
  unit       TEXT,
  unit_case  TEXT,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(active) WHERE active;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Lectura para todo el equipo: la app movil cachea el catalogo offline,
-- igual que hace con stores.
DROP POLICY IF EXISTS "products_read_auth" ON public.products;
CREATE POLICY "products_read_auth" ON public.products
  FOR SELECT TO authenticated USING (TRUE);

-- Escritura solo admin: el catalogo lo mantiene la ingesta con service role
-- o la direccion, nunca el personal de campo.
DROP POLICY IF EXISTS "products_write_admin" ON public.products;
CREATE POLICY "products_write_admin" ON public.products
  FOR ALL TO authenticated
  USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());

-- ============================================================
-- TABLE: competition_reports (v2.0: + visit_id, ligado al check-in)
-- ============================================================
CREATE TABLE IF NOT EXISTS competition_reports (
  report_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID REFERENCES sessions(session_id) ON DELETE CASCADE,
  visit_id        UUID REFERENCES visits(visit_id) ON DELETE SET NULL,  -- v2.0
  store_id        UUID REFERENCES stores(store_id) ON DELETE SET NULL,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  brand_id        UUID REFERENCES competitor_brands(brand_id) ON DELETE SET NULL,
  activation_type TEXT CHECK (activation_type IN
    ('promocion','material_pop','espacios_exhibiciones','impulso_activacion','degustacion','otro')),
  photo_urls      TEXT[] DEFAULT '{}',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  synced          BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_comp_reports_session ON competition_reports(session_id);
CREATE INDEX IF NOT EXISTS idx_comp_reports_store   ON competition_reports(store_id);
CREATE INDEX IF NOT EXISTS idx_comp_reports_visit   ON competition_reports(visit_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE stores              ENABLE ROW LEVEL SECURITY;
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_pings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits              ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_brands   ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_reports ENABLE ROW LEVEL SECURITY;

-- Drop primero para que el script sea re-ejecutable
DROP POLICY IF EXISTS "stores_read_authenticated" ON stores;
DROP POLICY IF EXISTS "stores_insert_staff"       ON stores;
DROP POLICY IF EXISTS "stores_update_staff"       ON stores;
DROP POLICY IF EXISTS "users_own_profile"         ON users;
DROP POLICY IF EXISTS "users_supervisor_read"     ON users;
DROP POLICY IF EXISTS "contacts_read_auth"        ON contacts;
DROP POLICY IF EXISTS "contacts_write_staff"      ON contacts;
DROP POLICY IF EXISTS "engagements_read_auth"     ON contact_engagements;
DROP POLICY IF EXISTS "engagements_write_auth"    ON contact_engagements;
DROP POLICY IF EXISTS "routes_own"                ON routes;
DROP POLICY IF EXISTS "routes_supervisor_read"    ON routes;
DROP POLICY IF EXISTS "sessions_own"              ON sessions;
DROP POLICY IF EXISTS "sessions_supervisor_read"  ON sessions;
DROP POLICY IF EXISTS "pings_own"                 ON location_pings;
DROP POLICY IF EXISTS "pings_supervisor_read"     ON location_pings;
DROP POLICY IF EXISTS "visits_own"                ON visits;
DROP POLICY IF EXISTS "visits_supervisor_read"    ON visits;
DROP POLICY IF EXISTS "tasks_rw"                  ON tasks;
DROP POLICY IF EXISTS "tasks_select"              ON tasks;
DROP POLICY IF EXISTS "tasks_update"              ON tasks;
DROP POLICY IF EXISTS "brands_read_auth"          ON competitor_brands;
DROP POLICY IF EXISTS "comp_reports_own"          ON competition_reports;
DROP POLICY IF EXISTS "comp_reports_supervisor_read" ON competition_reports;

-- stores: lectura (stores_read) e INSERT/UPDATE (alta/edición) se definen más
-- abajo, después de fn_can_see_store()/fn_is_admin()/fn_is_merchandiser()
-- (alcance por cliente). Sin DELETE (se desactiva con active=false).

-- users: perfil propio. La lectura del resto del equipo (users_staff_read) se
-- define más abajo, junto con las demás políticas de alcance por cliente.
CREATE POLICY "users_own_profile" ON users
  FOR ALL TO authenticated USING (auth.uid() = id);

-- FOR ALL sin WITH CHECK reutiliza el USING para las escrituras: sin esto,
-- cualquier usuario autenticado puede hacer UPDATE sobre CUALQUIER columna de
-- su propia fila, incluida `role` (auto-ascenso a admin). El revoke debe ser
-- de TABLA completa: un revoke a nivel de columna no basta, porque el grant
-- por defecto de Supabase (GRANT ALL ON ALL TABLES ... TO authenticated) es a
-- nivel de tabla y este domina sobre cualquier revoke de columna.
REVOKE UPDATE ON public.users FROM authenticated, anon;
GRANT UPDATE (full_name) ON public.users TO authenticated;

-- contacts: lectura (contacts_read) se define más abajo, después de
-- fn_can_see_store()/fn_is_merchandiser() (alcance por cliente). Escritura
-- (contacts_write_staff) también se define más abajo.

-- ============================================================
-- RPC: fijar el encargado (is_primary) de una tienda de forma atómica.
-- Desmarca al anterior y marca al nuevo en una transacción, respetando
-- el índice único parcial uq_contacts_primary_per_store.
-- SECURITY INVOKER: el RLS de contacts (contacts_write_staff) autoriza la escritura.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_set_primary_contact(p_store_id uuid, p_contact_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  -- 1) desmarcar otros primarios activos de la tienda
  UPDATE public.contacts SET is_primary = false
   WHERE store_id = p_store_id AND is_primary AND active AND contact_id <> p_contact_id;
  -- 2) marcar el objetivo
  UPDATE public.contacts SET is_primary = true
   WHERE contact_id = p_contact_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fn_set_primary_contact(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_set_primary_contact(uuid, uuid) TO authenticated;

-- engagements: lectura (engagements_read) se define más abajo, después de
-- fn_can_see_store() (alcance por cliente). Escritura (engagements_write_auth)
-- también se define más abajo.

-- routes: dueño lee las suyas. La lectura del resto del equipo interno
-- (routes_staff_read) se define más abajo, junto con sessions/pings/users.
CREATE POLICY "routes_own" ON routes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- sessions: dueño gestiona las suyas. La lectura del resto del equipo interno
-- (sessions_staff_read) se define más abajo — excepción deliberada del Mapa:
-- el recorrido GPS es continuo y cruza cadenas.
CREATE POLICY "sessions_own" ON sessions
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- location_pings (v2.0): dueño escribe/lee lo suyo. Lectura del resto del
-- equipo (pings_staff_read) se define más abajo (misma excepción del Mapa).
CREATE POLICY "pings_own" ON location_pings
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- visits: dueño gestiona. Lectura por alcance de cliente (visits_assigned_read)
-- se define más abajo, después de fn_can_see_store().
CREATE POLICY "visits_own" ON visits
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- tasks (v2.0): el INSERT lo hace SOLO el trigger (SECURITY DEFINER); los
-- clientes leen y actualizan estado. tasks_select/tasks_update se definen más
-- abajo, después de fn_can_see_store() (alcance por cliente).

-- competitor_brands: lectura global autenticada
CREATE POLICY "brands_read_auth" ON competitor_brands
  FOR SELECT TO authenticated USING (TRUE);

-- competition_reports: el autor gestiona lo suyo. Lectura por alcance de
-- cliente (comp_reports_assigned_read) se define más abajo.
CREATE POLICY "comp_reports_own" ON competition_reports
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- Visibilidad GLOBAL del rol 'admin' (Director de Ventas)
-- El admin ve TODO: gerentes y, en cascada, los asesores de esos gerentes.
-- fn_is_admin() es SECURITY DEFINER para evitar la recursión infinita que
-- provocaría una política sobre `users` que consulte `users`.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin' AND active
  );
$$;
REVOKE EXECUTE ON FUNCTION public.fn_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_is_admin() TO authenticated;

alter table public.client_assignments enable row level security;

-- Cada quien ve sus propias asignaciones; los admin ven y administran todas.
create policy client_assignments_own_read on public.client_assignments
  for select to authenticated using (user_id = auth.uid());

create policy client_assignments_admin_all on public.client_assignments
  for all to authenticated using (public.fn_is_admin()) with check (public.fn_is_admin());

-- ============================================================
-- Funciones auxiliares de alcance (Hub: alcance por cliente)
-- SECURITY DEFINER es OBLIGATORIO: sin él, leer client_assignments dentro de
-- una política sobre client_assignments provoca recursión infinita.
-- fn_can_see_store va después de fn_is_admin() porque la invoca.
-- ============================================================
create or replace function public.fn_my_client_ids()
returns setof uuid
language sql
stable
security definer
SET search_path = ''
as $$
  select client_id from public.client_assignments where user_id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.fn_my_client_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_my_client_ids() TO authenticated;

-- El equipo trabaja en Venezuela (UTC-4) y la sesion de la base corre en UTC.
-- Sin estas dos, un check-in de las 21:56 hora local cae en el dia UTC siguiente
-- y su visita se contaria como incumplida contra la ruta de ese dia.
create or replace function public.fn_fecha_local(p_ts timestamptz)
returns date
language sql
stable
set search_path to ''
as $$
  select (p_ts at time zone 'America/Caracas')::date;
$$;

create or replace function public.fn_hoy()
returns date
language sql
stable
set search_path to ''
as $$
  select (now() at time zone 'America/Caracas')::date;
$$;

-- Cumplimiento de ruta: de las visitas que la ruta planificaba para los dias ya
-- transcurridos, cuantas se hicieron. Una visita cuenta como hecha si existe un
-- check-in de ese usuario, en esa tienda, ese mismo dia (hora local Venezuela),
-- y no fue una omision.
-- SECURITY INVOKER (a diferencia de fn_is_admin()/fn_my_client_ids()): el
-- recorte por cliente se aplica explicitamente dentro de la funcion, no se
-- delega solo a RLS, porque stores_read expone las 197 tiendas a cualquier
-- mercaderista (cache offline de la app) y varios de ellos tambien entran al panel.
create or replace function public.fn_dash_cumplimiento(p_desde date, p_hasta date)
returns table (user_id uuid, full_name text, planificadas bigint, hechas bigint, pct integer)
language sql
stable
security invoker
set search_path to ''
as $$
  with planificado as (
    select r.user_id as uid, r.route_date, unnest(r.store_ids) as store_id
    from public.routes r
    -- Solo dias YA transcurridos, sin contar hoy: el dia en curso no puede
    -- entrar como "planificado" mientras el equipo todavia esta trabajando
    -- (revision final de rama, punto 1 — least(..., fn_hoy()) incluia hoy).
    where r.route_date between p_desde and least(p_hasta, public.fn_hoy() - 1)
  ),
  en_alcance as (
    select p.uid, p.route_date, p.store_id
    from planificado p
    join public.stores s on s.store_id = p.store_id
    where public.fn_is_admin()
       or s.client_id in (select public.fn_my_client_ids())
  ),
  evaluado as (
    select e.uid,
           exists (
             select 1 from public.visits v
             where v.user_id = e.uid
               and v.store_id = e.store_id
               and public.fn_fecha_local(v.check_in_time) = e.route_date
               and v.status <> 'skipped'
           ) as hecha
    from en_alcance e
  )
  select ev.uid,
         u.full_name,
         count(*)::bigint as planificadas,
         count(*) filter (where ev.hecha)::bigint as hechas,
         case when count(*) = 0 then 0
              else round(100.0 * count(*) filter (where ev.hecha) / count(*))::int
         end as pct
  from evaluado ev
  join public.users u on u.id = ev.uid
  group by 1, 2
  order by 3 desc;
$$;

create or replace function public.fn_is_merchandiser()
returns boolean
language sql
stable
security definer
SET search_path = ''
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'merchandiser' and active
  );
$$;
REVOKE EXECUTE ON FUNCTION public.fn_is_merchandiser() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_is_merchandiser() TO authenticated;

create or replace function public.fn_can_see_store(p_store_id uuid)
returns boolean
language sql
stable
security definer
SET search_path = ''
as $$
  select public.fn_is_admin() or exists (
    select 1
    from public.stores s
    join public.client_assignments ca on ca.client_id = s.client_id
    where s.store_id = p_store_id and ca.user_id = auth.uid()
  );
$$;
REVOKE EXECUTE ON FUNCTION public.fn_can_see_store(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_can_see_store(uuid) TO authenticated;

-- ============================================================
-- Políticas de LECTURA acotadas por cliente asignado (alcance por cliente).
-- Reemplazan el eje "supervisor_id" (jerarquía de personas) por el eje
-- "cliente asignado" (client_assignments) vía fn_can_see_store()/fn_my_client_ids().
-- sessions/location_pings/routes/users son excepción deliberada del Mapa: el
-- recorrido GPS es continuo y cruza cadenas, así que todo el equipo interno
-- lo ve completo.
-- ============================================================

-- stores: el mercaderista conserva el catálogo completo (la app cachea offline).
DROP POLICY IF EXISTS "stores_read" ON stores;
CREATE POLICY "stores_read" ON stores
  FOR SELECT TO authenticated USING (
    public.fn_is_admin()
    OR public.fn_is_merchandiser()
    OR client_id IN (SELECT public.fn_my_client_ids())
  );

-- clients
DROP POLICY IF EXISTS "clients_select" ON clients;
CREATE POLICY "clients_select" ON clients
  FOR SELECT TO authenticated USING (
    public.fn_is_admin()
    OR public.fn_is_merchandiser()
    OR client_id IN (SELECT public.fn_my_client_ids())
  );

-- contacts: data comercial sensible (teléfonos, correos, cumpleaños).
DROP POLICY IF EXISTS "contacts_read" ON contacts;
CREATE POLICY "contacts_read" ON contacts
  FOR SELECT TO authenticated
  USING (public.fn_is_merchandiser() OR public.fn_can_see_store(store_id));

-- contact_engagements
DROP POLICY IF EXISTS "engagements_read" ON contact_engagements;
CREATE POLICY "engagements_read" ON contact_engagements
  FOR SELECT TO authenticated
  USING (author_user_id = auth.uid() OR public.fn_can_see_store(store_id));

-- visits: el supervisor directo deja de ser el eje; pasa a serlo la tienda.
DROP POLICY IF EXISTS "visits_assigned_read" ON visits;
CREATE POLICY "visits_assigned_read" ON visits
  FOR SELECT TO authenticated USING (public.fn_can_see_store(store_id));

-- visit_anomaly_products: lectura por la tienda de la visita, escritura por el autor.
DROP POLICY IF EXISTS "vap_read" ON public.visit_anomaly_products;
CREATE POLICY "vap_read" ON public.visit_anomaly_products
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.visits v
            WHERE v.visit_id = visit_anomaly_products.visit_id
              AND public.fn_can_see_store(v.store_id))
  );

DROP POLICY IF EXISTS "vap_write_own" ON public.visit_anomaly_products;
CREATE POLICY "vap_write_own" ON public.visit_anomaly_products
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.visits v
                 WHERE v.visit_id = visit_anomaly_products.visit_id AND v.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.visits v
                      WHERE v.visit_id = visit_anomaly_products.visit_id AND v.user_id = auth.uid()));

-- tasks: la tarea sigue a su tienda (spec §4.2, "el acceso lo da la
-- asignación del cliente, no assignee_user_id"). Se conserva
-- created_by_user_id para que el mercaderista siga viendo las que él mismo
-- generó desde la app, aunque la tienda no esté en su cartera comercial.
DROP POLICY IF EXISTS "tasks_select" ON tasks;
CREATE POLICY "tasks_select" ON tasks
  FOR SELECT TO authenticated
  USING (
    created_by_user_id = auth.uid()
    OR (store_id IS NOT NULL AND public.fn_can_see_store(store_id))
  );

DROP POLICY IF EXISTS "tasks_update" ON tasks;
CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE TO authenticated
  USING (
    created_by_user_id = auth.uid()
    OR (store_id IS NOT NULL AND public.fn_can_see_store(store_id))
  )
  WITH CHECK (
    created_by_user_id = auth.uid()
    OR (store_id IS NOT NULL AND public.fn_can_see_store(store_id))
  );

-- competition_reports
DROP POLICY IF EXISTS "comp_reports_assigned_read" ON competition_reports;
CREATE POLICY "comp_reports_assigned_read" ON competition_reports
  FOR SELECT TO authenticated
  USING (store_id IS NOT NULL AND public.fn_can_see_store(store_id));

-- sessions / location_pings / routes: excepción deliberada del Mapa.
DROP POLICY IF EXISTS "sessions_staff_read" ON sessions;
CREATE POLICY "sessions_staff_read" ON sessions FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "pings_staff_read" ON location_pings;
CREATE POLICY "pings_staff_read" ON location_pings FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "routes_staff_read" ON routes;
CREATE POLICY "routes_staff_read" ON routes FOR SELECT TO authenticated USING (TRUE);

-- users: nombres visibles para todo el equipo interno (se usan en gráficos y
-- en el autor de cada tarea). La escritura sigue restringida (users_own_profile).
DROP POLICY IF EXISTS "users_staff_read" ON users;
CREATE POLICY "users_staff_read" ON users FOR SELECT TO authenticated USING (TRUE);

-- ============================================================
-- Políticas de ESCRITURA acotadas por cliente asignado (alcance por cliente).
-- Reemplazan las viejas basadas en role IN ('supervisor','admin'): un vendedor
-- ya no puede editar contactos/tiendas de cadenas que ni siquiera puede ver.
-- fn_can_see_store() ya devuelve TRUE para admin, así que no hace falta
-- una cláusula extra para ese rol en contacts/engagements/stores UPDATE.
-- ============================================================
DROP POLICY IF EXISTS "contacts_write_staff" ON contacts;
CREATE POLICY "contacts_write_staff" ON contacts
  FOR ALL TO authenticated
  USING (public.fn_can_see_store(store_id))
  WITH CHECK (public.fn_can_see_store(store_id));

DROP POLICY IF EXISTS "engagements_write_auth" ON contact_engagements;
CREATE POLICY "engagements_write_auth" ON contact_engagements
  FOR ALL TO authenticated
  USING (author_user_id = auth.uid() OR public.fn_can_see_store(store_id))
  WITH CHECK (author_user_id = auth.uid() OR public.fn_can_see_store(store_id));

DROP POLICY IF EXISTS "stores_update_staff" ON stores;
CREATE POLICY "stores_update_staff" ON stores
  FOR UPDATE TO authenticated
  USING (public.fn_can_see_store(store_id))
  WITH CHECK (public.fn_can_see_store(store_id));

-- stores INSERT: no hay tienda todavía que acotar, así que va por rol.
DROP POLICY IF EXISTS "stores_insert_staff" ON stores;
CREATE POLICY "stores_insert_staff" ON stores
  FOR INSERT TO authenticated
  WITH CHECK (
    public.fn_is_admin()
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'vendedor' AND u.active)
  );

DROP POLICY IF EXISTS "users_admin_read"        ON users;
DROP POLICY IF EXISTS "routes_admin_read"       ON routes;
DROP POLICY IF EXISTS "sessions_admin_read"     ON sessions;
DROP POLICY IF EXISTS "pings_admin_read"        ON location_pings;
DROP POLICY IF EXISTS "visits_admin_read"       ON visits;
DROP POLICY IF EXISTS "tasks_admin_read"        ON tasks;
DROP POLICY IF EXISTS "comp_reports_admin_read" ON competition_reports;

-- Lectura global para admin (ADITIVA a las políticas "_own"/"_supervisor_read").
-- Solo sobre tablas operativas que no son ya legibles por todo autenticado.
CREATE POLICY "users_admin_read"        ON users               FOR SELECT TO authenticated USING (public.fn_is_admin());
CREATE POLICY "routes_admin_read"       ON routes              FOR SELECT TO authenticated USING (public.fn_is_admin());
CREATE POLICY "sessions_admin_read"     ON sessions            FOR SELECT TO authenticated USING (public.fn_is_admin());
CREATE POLICY "pings_admin_read"        ON location_pings      FOR SELECT TO authenticated USING (public.fn_is_admin());
CREATE POLICY "visits_admin_read"       ON visits              FOR SELECT TO authenticated USING (public.fn_is_admin());
CREATE POLICY "tasks_admin_read"        ON tasks               FOR SELECT TO authenticated USING (public.fn_is_admin());
CREATE POLICY "comp_reports_admin_read" ON competition_reports FOR SELECT TO authenticated USING (public.fn_is_admin());

-- ============================================================
-- STORAGE: bucket visit-photos + políticas por carpeta de usuario
-- Estructura de path (Constitución): {user_id}/{visit_id}/{timestamp}.jpg
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('visit-photos', 'visit-photos', FALSE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "visit_photos_insert_own"  ON storage.objects;
DROP POLICY IF EXISTS "visit_photos_select_own_or_supervisor" ON storage.objects;
DROP POLICY IF EXISTS "visit_photos_select_scoped" ON storage.objects;

CREATE POLICY "visit_photos_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'visit-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- El admin ve TODAS las fotos, igual que ya ve todas las visitas y tareas
-- (políticas "_admin_read" más arriba). Sin esta rama, el hub le muestra el
-- reporte pero no puede firmar las imágenes del bucket privado. [BUG-025]
-- La ruta es {user_id}/{visit_id}/{n}.jpg: el visit_id permite llegar hasta
-- la tienda y su cliente sin tocar la app móvil (alcance por cliente).
CREATE POLICY "visit_photos_select_scoped" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'visit-photos'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.fn_is_admin()
      OR EXISTS (
        SELECT 1 FROM public.visits v
        WHERE v.visit_id::text = (storage.foldername(name))[2]
          AND public.fn_can_see_store(v.store_id)
      )
    )
  );

-- ============================================================
-- fn_dash_resumen(): las 4 tarjetas superiores del panel gerencial
-- (visitas, tasa de anomalias, cumplimiento de ruta, tareas abiertas).
-- Va despues de fn_is_admin()/fn_my_client_ids()/fn_dash_cumplimiento(),
-- a las que invoca. SECURITY INVOKER, mismo motivo que fn_dash_cumplimiento():
-- el recorte por cliente se aplica explicitamente, no se delega solo a RLS.
-- tareas_viejas = abiertas hace mas de 15 dias.
-- ============================================================
create or replace function public.fn_dash_resumen(p_desde date, p_hasta date)
returns table (
  visitas bigint, anomalias bigint, tasa_anomalias integer,
  planificadas bigint, hechas bigint, pct_cumplimiento integer,
  tareas_abiertas bigint, tareas_viejas bigint
)
language sql
stable
security invoker
set search_path to ''
as $$
  with v as (
    select vi.visit_id, vi.status
    from public.visits vi
    join public.stores s on s.store_id = vi.store_id
    where public.fn_fecha_local(vi.check_in_time) between p_desde and p_hasta
      and vi.status <> 'skipped'
      and (public.fn_is_admin() or s.client_id in (select public.fn_my_client_ids()))
  ),
  c as (
    select coalesce(sum(planificadas), 0)::bigint as pl,
           coalesce(sum(hechas), 0)::bigint as he
    from public.fn_dash_cumplimiento(p_desde, p_hasta)
  ),
  t as (
    select ta.task_id, ta.created_at
    from public.tasks ta
    join public.stores s on s.store_id = ta.store_id
    where ta.status = 'open'
      and (public.fn_is_admin() or s.client_id in (select public.fn_my_client_ids()))
  )
  select
    (select count(*) from v)::bigint,
    (select count(*) from v where status = 'anomaly')::bigint,
    case when (select count(*) from v) = 0 then 0
         else round(100.0 * (select count(*) from v where status = 'anomaly')
                          / (select count(*) from v))::int end,
    c.pl,
    c.he,
    case when c.pl = 0 then 0 else round(100.0 * c.he / c.pl)::int end,
    (select count(*) from t)::bigint,
    -- Dias naturales (fn_fecha_local), no aritmetica de instantes: debe
    -- coincidir con fn_dash_backlog_tareas(), que mide lo mismo (revision
    -- final de rama, punto 3 — daban 65 vs 63 para la misma cifra).
    (select count(*) from t where public.fn_fecha_local(created_at) < public.fn_hoy() - 15)::bigint
  from c;
$$;

-- ============================================================
-- fn_dash_visitas_por_cliente() / fn_dash_anomalias(): distribucion por
-- cadena y anomalias por tipo (con comparacion contra el periodo anterior)
-- para los graficos de distribucion del panel gerencial. Van despues de
-- fn_is_admin()/fn_my_client_ids()/fn_fecha_local(), a las que invocan.
-- SECURITY INVOKER: el recorte por cliente se aplica explicitamente,
-- no se delega solo a RLS (stores_read expone las 197 tiendas a todo
-- mercaderista para la cache offline movil).
-- ============================================================
create or replace function public.fn_dash_visitas_por_cliente(p_desde date, p_hasta date)
returns table (cliente text, visitas bigint, anomalias bigint)
language sql
stable
security invoker
set search_path to ''
as $$
  select coalesce(c.name, 'Sin cadena') as cliente,
         count(*)::bigint,
         count(*) filter (where v.status = 'anomaly')::bigint
  from public.visits v
  join public.stores s on s.store_id = v.store_id
  left join public.clients c on c.client_id = s.client_id
  where public.fn_fecha_local(v.check_in_time) between p_desde and p_hasta
    and v.status <> 'skipped'
    and (public.fn_is_admin() or s.client_id in (select public.fn_my_client_ids()))
  group by 1
  order by 2 desc;
$$;

-- anomaly_type es TEXT[]: una visita puede reportar varias anomalias a la vez,
-- por eso se desagrega con unnest. n_periodo_anterior permite mostrar tendencia.
create or replace function public.fn_dash_anomalias(p_desde date, p_hasta date)
returns table (tipo text, n bigint, n_periodo_anterior bigint)
language sql
stable
security invoker
set search_path to ''
as $$
  with dias as (select (p_hasta - p_desde) as d),
  base as (
    select v.visit_id, unnest(v.anomaly_type) as tipo,
           public.fn_fecha_local(v.check_in_time) as f
    from public.visits v
    join public.stores s on s.store_id = v.store_id
    where v.status = 'anomaly' and v.anomaly_type is not null
      and (public.fn_is_admin() or s.client_id in (select public.fn_my_client_ids()))
      and public.fn_fecha_local(v.check_in_time)
          between (p_desde - (select d from dias) - 1) and p_hasta
  )
  select b.tipo,
         count(*) filter (where b.f between p_desde and p_hasta)::bigint,
         count(*) filter (where b.f < p_desde)::bigint
  from base b
  group by 1
  order by 2 desc;
$$;

-- ============================================================
-- fn_dash_tiendas_sin_visita() / fn_dash_tiendas_criticas(): tiendas
-- abandonadas (sin visita reciente) y tiendas con mas anomalias, para
-- las tablas accionables del panel gerencial. Van despues de
-- fn_is_admin()/fn_my_client_ids()/fn_fecha_local()/fn_hoy(), a las
-- que invocan. SECURITY INVOKER: el recorte por cliente se aplica
-- explicitamente, no se delega solo a RLS (stores_read expone las
-- 197 tiendas a todo mercaderista para la cache offline movil).
-- ============================================================

-- Tiendas activas sin ninguna visita en los ultimos p_dias. Una tienda que nunca
-- se ha visitado tambien aparece: dias_sin_visita queda en NULL y ordena primero.
create or replace function public.fn_dash_tiendas_sin_visita(p_dias integer)
returns table (store_id uuid, tienda text, cliente text, clasificacion text, dias_sin_visita integer)
language sql
stable
security invoker
set search_path to ''
as $$
  select s.store_id,
         s.name,
         coalesce(c.name, 'Sin cadena'),
         s.classification,
         (public.fn_hoy() - max(public.fn_fecha_local(v.check_in_time)))::int
  from public.stores s
  left join public.clients c on c.client_id = s.client_id
  -- v.status <> 'skipped': una visita omitida no debe apagar la alarma de
  -- abandono (revision final de rama, punto 2). Es la unica funcion de este
  -- bloque que tocaba visits sin ese filtro.
  left join public.visits v on v.store_id = s.store_id and v.status <> 'skipped'
  where s.active
    and (public.fn_is_admin() or s.client_id in (select public.fn_my_client_ids()))
  group by s.store_id, s.name, c.name, s.classification
  having max(public.fn_fecha_local(v.check_in_time)) is null
      or max(public.fn_fecha_local(v.check_in_time)) < public.fn_hoy() - p_dias
  order by 5 desc nulls first, 2;
$$;

create or replace function public.fn_dash_tiendas_criticas(p_desde date, p_hasta date, p_limite integer)
returns table (store_id uuid, tienda text, cliente text, anomalias bigint, visitas bigint)
language sql
stable
security invoker
set search_path to ''
as $$
  select s.store_id,
         s.name,
         coalesce(c.name, 'Sin cadena'),
         count(*) filter (where v.status = 'anomaly')::bigint,
         count(*)::bigint
  from public.visits v
  join public.stores s on s.store_id = v.store_id
  left join public.clients c on c.client_id = s.client_id
  where public.fn_fecha_local(v.check_in_time) between p_desde and p_hasta
    and v.status <> 'skipped'
    and (public.fn_is_admin() or s.client_id in (select public.fn_my_client_ids()))
  group by s.store_id, s.name, c.name
  having count(*) filter (where v.status = 'anomaly') > 0
  -- s.store_id desempata: sin el, las tiendas empatadas entran y salen del top-N
  -- entre refrescos sin que cambie ningun dato, y el panel deja de ser fiable.
  order by 4 desc, 5 desc, s.store_id
  limit p_limite;
$$;

-- ============================================================
-- fn_dash_backlog_tareas() / fn_dash_tiempo_resolucion() / fn_dash_cumpleanos() /
-- fn_dash_clientes_sin_vendedor(): bloque "que me toca hacer hoy" del panel
-- gerencial. Van despues de fn_is_admin()/fn_my_client_ids()/fn_hoy(), a las
-- que invocan. SECURITY INVOKER: el recorte por cliente se aplica
-- explicitamente en las tres primeras, salvo en fn_dash_clientes_sin_vendedor(),
-- que es una alerta de admin y no lleva ese filtro.
-- ============================================================

-- Antiguedad del backlog abierto, en tramos fijos.
create or replace function public.fn_dash_backlog_tareas()
returns table (tramo text, n bigint)
language sql
stable
security invoker
set search_path to ''
as $$
  with t as (
    -- fn_fecha_local(), no ::date crudo: el cast crudo usa la zona de la
    -- sesion (UTC) en vez de America/Caracas (revision final de rama, punto 4).
    select (public.fn_hoy() - public.fn_fecha_local(ta.created_at)) as dias
    from public.tasks ta
    join public.stores s on s.store_id = ta.store_id
    where ta.status = 'open'
      and (public.fn_is_admin() or s.client_id in (select public.fn_my_client_ids()))
  ),
  tramos(tramo, orden) as (
    values ('0-7', 1), ('8-15', 2), ('16-30', 3), ('+30', 4)
  )
  select tr.tramo,
         count(t.dias) filter (
           where (tr.tramo = '0-7'   and t.dias between 0 and 7)
              or (tr.tramo = '8-15'  and t.dias between 8 and 15)
              or (tr.tramo = '16-30' and t.dias between 16 and 30)
              or (tr.tramo = '+30'   and t.dias > 30)
         )::bigint
  from tramos tr left join t on true
  group by tr.tramo, tr.orden
  order by tr.orden;
$$;

-- Tiempo medio de resolucion. resolved_at se llena desde el Plan 1, asi que al
-- principio devolvera 0 resueltas: es correcto, no un fallo.
create or replace function public.fn_dash_tiempo_resolucion(p_desde date, p_hasta date)
returns table (resueltas bigint, horas_promedio numeric)
language sql
stable
security invoker
set search_path to ''
as $$
  select count(*)::bigint,
         round(avg(extract(epoch from (ta.resolved_at - ta.created_at)) / 3600.0)::numeric, 1)
  from public.tasks ta
  join public.stores s on s.store_id = ta.store_id
  where ta.resolved_at is not null
    -- fn_fecha_local(), no ::date crudo (revision final de rama, punto 4).
    and public.fn_fecha_local(ta.resolved_at) between p_desde and p_hasta
    and (public.fn_is_admin() or s.client_id in (select public.fn_my_client_ids()));
$$;

-- Auxiliar: construye la fecha de un cumpleanos en un anio dado, sin reventar
-- en anios no bisiestos cuando el nacimiento fue un 29 de febrero.
-- make_date(y,2,29) lanza "date field value out of range" en anios normales;
-- como fn_dash_cumpleanos es una sola sentencia SQL (no PL/pgSQL), esa
-- excepcion tumbaria la funcion entera para todos los llamantes. En vez de
-- eso: make_date(y,3,1) - 1 da 28-feb en normales y 29-feb en bisiestos.
create or replace function public.fn_cumple_en(p_birthday date, p_anio integer)
returns date
language sql
immutable
security invoker
set search_path to ''
as $$
  select case
           when extract(month from p_birthday) = 2 and extract(day from p_birthday) = 29
           then make_date(p_anio, 3, 1) - 1
           else make_date(p_anio, extract(month from p_birthday)::int,
                                   extract(day from p_birthday)::int)
         end;
$$;

-- Cumpleanos de compradores en los proximos p_dias, cruzando el año.
create or replace function public.fn_dash_cumpleanos(p_dias integer)
returns table (contact_id uuid, nombre text, cargo text, tienda text, cliente text,
               cumple date, dias_para integer)
language sql
stable
security invoker
set search_path to ''
as $$
  with c as (
    select ct.contact_id, ct.full_name, ct.role_title, ct.birthday,
           s.name as tienda, coalesce(cl.name, 'Sin cadena') as cliente,
           -- Proxima ocurrencia del cumpleanos a partir de hoy.
           case
             when public.fn_cumple_en(ct.birthday, extract(year from public.fn_hoy())::int) >= public.fn_hoy()
             then public.fn_cumple_en(ct.birthday, extract(year from public.fn_hoy())::int)
             else public.fn_cumple_en(ct.birthday, extract(year from public.fn_hoy())::int + 1)
           end as proximo
    from public.contacts ct
    join public.stores s on s.store_id = ct.store_id
    left join public.clients cl on cl.client_id = s.client_id
    where ct.active and ct.birthday is not null
      and (public.fn_is_admin() or s.client_id in (select public.fn_my_client_ids()))
  )
  select c.contact_id, c.full_name, c.role_title, c.tienda, c.cliente,
         c.proximo, (c.proximo - public.fn_hoy())::int
  from c
  where c.proximo <= public.fn_hoy() + p_dias
  order by c.proximo, c.full_name;
$$;

-- Alerta del panel de admin: clientes activos sin ningun vendedor asignado.
-- El filtro admin va DENTRO de la funcion: el hub oculta, no protege. Un
-- mercaderista con acceso RPC directo veria el resultado integro porque
-- clients_select le concede catalogo completo para la cache offline movil.
create or replace function public.fn_dash_clientes_sin_vendedor()
returns table (client_id uuid, cliente text, tiendas_activas bigint)
language sql
stable
security invoker
set search_path to ''
as $$
  select c.client_id, c.name, count(s.store_id) filter (where s.active)::bigint
  from public.clients c
  left join public.stores s on s.client_id = c.client_id
  where public.fn_is_admin()
    and c.active
    and not exists (select 1 from public.client_assignments ca where ca.client_id = c.client_id)
  group by c.client_id, c.name
  order by 3 desc, 2;
$$;
