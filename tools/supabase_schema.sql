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
CREATE POLICY clients_select ON clients FOR SELECT TO authenticated USING (true);

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
  role          TEXT NOT NULL DEFAULT 'merchandiser' CHECK (role IN ('merchandiser','supervisor','admin')),
  supervisor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_supervisor ON users(supervisor_id);

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
  anomaly_type      TEXT CHECK (anomaly_type IN ('sin_stock','cambio_planograma','diferencia_precios','producto_danado','otro')),
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
  created_at         TIMESTAMPTZ DEFAULT NOW()
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
BEGIN
  IF NEW.status = 'anomaly' THEN
    IF EXISTS (SELECT 1 FROM public.tasks WHERE source_visit_id = NEW.visit_id) THEN
      RETURN NEW;
    END IF;
    SELECT supervisor_id INTO v_supervisor FROM public.users WHERE id = NEW.user_id;
    INSERT INTO public.tasks
      (assignee_user_id, created_by_user_id, store_id, source_visit_id, task_type, title, description, status)
    VALUES (
      v_supervisor,
      NEW.user_id,
      NEW.store_id,
      NEW.visit_id,
      public.fn_task_type_from_anomaly(NEW.anomaly_type),
      'Anomalía: ' || COALESCE(NEW.anomaly_type, 'otro'),
      NEW.observations,   -- v2.0: contexto del check-in directo en la tarea
      'open'              -- v2.0: vocabulario open/resolved
    );
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

-- stores: lectura autenticada; escritura (alta/edición) supervisor/admin. Sin DELETE (se desactiva con active=false).
CREATE POLICY "stores_read_authenticated" ON stores
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "stores_insert_staff" ON stores
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('supervisor','admin')));
CREATE POLICY "stores_update_staff" ON stores
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('supervisor','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('supervisor','admin')));

-- users: perfil propio + el supervisor ve a sus vendedores
CREATE POLICY "users_own_profile" ON users
  FOR ALL TO authenticated USING (auth.uid() = id);
CREATE POLICY "users_supervisor_read" ON users
  FOR SELECT TO authenticated USING (supervisor_id = auth.uid());

-- contacts: lectura autenticada; escritura supervisor/admin
CREATE POLICY "contacts_read_auth" ON contacts
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "contacts_write_staff" ON contacts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('supervisor','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('supervisor','admin')));

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

-- engagements: lectura autenticada; escribe el autor o staff
CREATE POLICY "engagements_read_auth" ON contact_engagements
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "engagements_write_auth" ON contact_engagements
  FOR ALL TO authenticated
  USING (author_user_id = auth.uid()
         OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('supervisor','admin')))
  WITH CHECK (author_user_id = auth.uid()
              OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('supervisor','admin')));

-- routes: dueño lee las suyas; supervisor lee las de sus vendedores
CREATE POLICY "routes_own" ON routes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "routes_supervisor_read" ON routes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = routes.user_id AND u.supervisor_id = auth.uid()));

-- sessions: dueño gestiona las suyas; supervisor lee (v2.0: mapa en vivo)
CREATE POLICY "sessions_own" ON sessions
  FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sessions_supervisor_read" ON sessions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = sessions.user_id AND u.supervisor_id = auth.uid()));

-- location_pings (v2.0): dueño escribe/lee lo suyo; supervisor lee
CREATE POLICY "pings_own" ON location_pings
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "pings_supervisor_read" ON location_pings
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = location_pings.user_id AND u.supervisor_id = auth.uid()));

-- visits: dueño gestiona; supervisor lee
CREATE POLICY "visits_own" ON visits
  FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "visits_supervisor_read" ON visits
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = visits.user_id AND u.supervisor_id = auth.uid()));

-- tasks (v2.0): el INSERT lo hace SOLO el trigger (SECURITY DEFINER); los clientes leen y actualizan estado
CREATE POLICY "tasks_select" ON tasks
  FOR SELECT TO authenticated
  USING (assignee_user_id = auth.uid()
         OR created_by_user_id = auth.uid()
         OR EXISTS (SELECT 1 FROM users u WHERE u.id = created_by_user_id AND u.supervisor_id = auth.uid()));
CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE TO authenticated
  USING (assignee_user_id = auth.uid()
         OR created_by_user_id = auth.uid()
         OR EXISTS (SELECT 1 FROM users u WHERE u.id = created_by_user_id AND u.supervisor_id = auth.uid()))
  WITH CHECK (assignee_user_id = auth.uid()
              OR created_by_user_id = auth.uid()
              OR EXISTS (SELECT 1 FROM users u WHERE u.id = created_by_user_id AND u.supervisor_id = auth.uid()));

-- competitor_brands: lectura global autenticada
CREATE POLICY "brands_read_auth" ON competitor_brands
  FOR SELECT TO authenticated USING (TRUE);

-- competition_reports: el autor gestiona lo suyo; supervisor SOLO lee (DELETE evalúa únicamente USING)
CREATE POLICY "comp_reports_own" ON competition_reports
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "comp_reports_supervisor_read" ON competition_reports
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = competition_reports.user_id AND u.supervisor_id = auth.uid()));

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

CREATE POLICY "visit_photos_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'visit-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "visit_photos_select_own_or_supervisor" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'visit-photos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id::text = (storage.foldername(name))[1]
          AND u.supervisor_id = auth.uid()
      )
    )
  );
