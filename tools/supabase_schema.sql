-- ============================================================
-- Ponzivenzo Smart Tracker — Supabase Schema v1.0
-- Correr en: Supabase Dashboard → SQL Editor
-- ============================================================

-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: stores (Master store list)
-- ============================================================
CREATE TABLE IF NOT EXISTS stores (
  store_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  address         TEXT,
  master_lat      DOUBLE PRECISION NOT NULL,
  master_lng      DOUBLE PRECISION NOT NULL,
  master_location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(master_lng, master_lat), 4326)::geography
  ) STORED,
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── stores: segmentación CRM (zona, canal, clasificación) ──
ALTER TABLE stores ADD COLUMN IF NOT EXISTS estado           TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS municipio        TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS urbanizacion     TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS business_channel TEXT
  CHECK (business_channel IN ('drogueria','farmacia','supermercado','autoservicio','mayorista','otro'));
ALTER TABLE stores ADD COLUMN IF NOT EXISTS classification   TEXT
  CHECK (classification IN ('A','B','C'));
CREATE INDEX IF NOT EXISTS idx_stores_estado         ON stores(estado);
CREATE INDEX IF NOT EXISTS idx_stores_channel        ON stores(business_channel);
CREATE INDEX IF NOT EXISTS idx_stores_classification ON stores(classification);

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
-- TABLE: users (Merchandiser profiles — linked to Supabase Auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL,
  email           TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'merchandiser' CHECK (role IN ('merchandiser', 'supervisor', 'admin')),
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── users: jerarquía supervisor↔vendedor (un supervisor por vendedor) ──
ALTER TABLE users ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_supervisor ON users(supervisor_id);

-- ============================================================
-- TABLE: routes (Daily route assignments)
-- ============================================================
CREATE TABLE IF NOT EXISTS routes (
  route_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  route_date      DATE NOT NULL,
  store_ids       UUID[] NOT NULL,  -- ordered list of store_ids for the day
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, route_date)
);

-- ── routes: marca de ruta especial (ej. 24/31 dic) ──
ALTER TABLE routes ADD COLUMN IF NOT EXISTS is_special BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================
-- TABLE: sessions (Route session tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  session_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  route_id        UUID NOT NULL REFERENCES routes(route_id) ON DELETE CASCADE,
  session_start   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_end     TIMESTAMPTZ,
  start_location  JSONB NOT NULL,  -- { lat, lng }
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: visits (Individual store check-ins)
-- ============================================================
CREATE TABLE IF NOT EXISTS visits (
  visit_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  store_id        UUID NOT NULL REFERENCES stores(store_id) ON DELETE RESTRICT,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  check_in_time   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_in_location JSONB,         -- { lat, lng }
  photo_urls      TEXT[] DEFAULT '{}',
  observations    TEXT,
  status          TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'skipped', 'anomaly')),
  synced          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── visits: anomalías tipificadas, motivo de omisión, última reposición ──
ALTER TABLE visits ADD COLUMN IF NOT EXISTS anomaly_type      TEXT
  CHECK (anomaly_type IN ('sin_stock','cambio_planograma','diferencia_precios','producto_danado','otro'));
ALTER TABLE visits ADD COLUMN IF NOT EXISTS skip_reason       TEXT
  CHECK (skip_reason IN ('fuera_de_ruta','sin_acceso','otro'));
ALTER TABLE visits ADD COLUMN IF NOT EXISTS last_restock_date DATE;
CREATE INDEX IF NOT EXISTS idx_visits_last_restock ON visits(store_id, last_restock_date);

-- ============================================================
-- TABLE: tasks (tareas; asignadas al supervisor del vendedor)
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  task_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignee_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  store_id           UUID REFERENCES stores(store_id) ON DELETE SET NULL,
  source_visit_id    UUID REFERENCES visits(visit_id) ON DELETE SET NULL,
  task_type          TEXT NOT NULL,
  title              TEXT,
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done')),
  created_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_store    ON tasks(store_id);

-- ── Generación automática de tareas desde anomalías ──
CREATE OR REPLACE FUNCTION fn_task_type_from_anomaly(p_anomaly TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_anomaly
    WHEN 'sin_stock'          THEN 'reponer_stock'
    WHEN 'cambio_planograma'  THEN 'contactar_comprador'
    WHEN 'diferencia_precios' THEN 'contactar_comprador'
    WHEN 'producto_danado'    THEN 'contactar_gerente'
    ELSE 'revisar_anomalia'
  END;
$$;

CREATE OR REPLACE FUNCTION fn_create_task_from_anomaly()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_supervisor UUID;
BEGIN
  IF NEW.status = 'anomaly' THEN
    -- no duplicar si ya existe tarea para esta visita
    IF EXISTS (SELECT 1 FROM tasks WHERE source_visit_id = NEW.visit_id) THEN
      RETURN NEW;
    END IF;
    SELECT supervisor_id INTO v_supervisor FROM users WHERE id = NEW.user_id;
    INSERT INTO tasks (assignee_user_id, created_by_user_id, store_id, source_visit_id, task_type, title, status)
    VALUES (
      v_supervisor,
      NEW.user_id,
      NEW.store_id,
      NEW.visit_id,
      fn_task_type_from_anomaly(NEW.anomaly_type),
      'Anomalía: ' || COALESCE(NEW.anomaly_type, 'otro'),
      'pending'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_visit_anomaly_task ON visits;
CREATE TRIGGER trg_visit_anomaly_task
  AFTER INSERT OR UPDATE OF status ON visits
  FOR EACH ROW EXECUTE FUNCTION fn_create_task_from_anomaly();

-- ============================================================
-- TABLE: competitor_brands (lookup editable de marcas competidoras)
-- ============================================================
CREATE TABLE IF NOT EXISTS competitor_brands (
  brand_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name      TEXT NOT NULL UNIQUE,
  active    BOOLEAN DEFAULT TRUE
);

-- ============================================================
-- TABLE: competition_reports (reportaje de competencia en campo)
-- ============================================================
CREATE TABLE IF NOT EXISTS competition_reports (
  report_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID REFERENCES sessions(session_id) ON DELETE CASCADE,
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

-- Seed editable (no-op si ya existen)
INSERT INTO competitor_brands (name) VALUES
  ('Genérico / Sin marca')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- ROW LEVEL SECURITY (RLS) Policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

-- Drop policies first so this script is safe to re-run
DROP POLICY IF EXISTS "stores_read_authenticated" ON stores;
DROP POLICY IF EXISTS "users_own_profile" ON users;
DROP POLICY IF EXISTS "routes_own" ON routes;
DROP POLICY IF EXISTS "sessions_own" ON sessions;
DROP POLICY IF EXISTS "visits_own" ON visits;

-- stores: All authenticated users can read
CREATE POLICY "stores_read_authenticated" ON stores
  FOR SELECT TO authenticated USING (TRUE);

-- users: Users can only see their own profile
CREATE POLICY "users_own_profile" ON users
  FOR ALL TO authenticated USING (auth.uid() = id);

-- routes: Users can only see their own routes
CREATE POLICY "routes_own" ON routes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- sessions: Users can manage their own sessions
CREATE POLICY "sessions_own" ON sessions
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- visits: Users can manage their own visits
CREATE POLICY "visits_own" ON visits
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- ── RLS de tablas nuevas + visibilidad de supervisor ──
ALTER TABLE contacts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_brands   ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contacts_read_auth"        ON contacts;
DROP POLICY IF EXISTS "contacts_write_staff"      ON contacts;
DROP POLICY IF EXISTS "engagements_read_auth"     ON contact_engagements;
DROP POLICY IF EXISTS "engagements_write_auth"    ON contact_engagements;
DROP POLICY IF EXISTS "tasks_assignee"            ON tasks;
DROP POLICY IF EXISTS "brands_read_auth"          ON competitor_brands;
DROP POLICY IF EXISTS "comp_reports_own"          ON competition_reports;
DROP POLICY IF EXISTS "users_supervisor_read"     ON users;
DROP POLICY IF EXISTS "routes_supervisor_read"    ON routes;
DROP POLICY IF EXISTS "visits_supervisor_read"    ON visits;

-- contacts: lectura autenticada; escritura supervisor/admin
CREATE POLICY "contacts_read_auth" ON contacts
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "contacts_write_staff" ON contacts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('supervisor','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('supervisor','admin')));

-- engagements: lectura autenticada; cualquiera autenticado puede registrar (autor)
CREATE POLICY "engagements_read_auth" ON contact_engagements
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "engagements_write_auth" ON contact_engagements
  FOR ALL TO authenticated
  USING (author_user_id = auth.uid()
         OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('supervisor','admin')))
  WITH CHECK (TRUE);

-- tasks: el asignado ve/edita sus tareas; supervisor ve las de sus vendedores
CREATE POLICY "tasks_assignee" ON tasks
  FOR ALL TO authenticated
  USING (assignee_user_id = auth.uid()
         OR created_by_user_id = auth.uid()
         OR EXISTS (SELECT 1 FROM users u WHERE u.id = created_by_user_id AND u.supervisor_id = auth.uid()))
  WITH CHECK (TRUE);

-- competitor_brands: lectura global autenticada
CREATE POLICY "brands_read_auth" ON competitor_brands
  FOR SELECT TO authenticated USING (TRUE);

-- competition_reports: el autor gestiona; supervisor lee las de sus vendedores
CREATE POLICY "comp_reports_own" ON competition_reports
  FOR ALL TO authenticated
  USING (user_id = auth.uid()
         OR EXISTS (SELECT 1 FROM users u WHERE u.id = competition_reports.user_id AND u.supervisor_id = auth.uid()))
  WITH CHECK (user_id = auth.uid());

-- Visibilidad de supervisor sobre sus vendedores (ADITIVA a las políticas "_own" existentes)
CREATE POLICY "users_supervisor_read" ON users
  FOR SELECT TO authenticated USING (supervisor_id = auth.uid());
CREATE POLICY "routes_supervisor_read" ON routes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = routes.user_id AND u.supervisor_id = auth.uid()));
CREATE POLICY "visits_supervisor_read" ON visits
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = visits.user_id AND u.supervisor_id = auth.uid()));

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_routes_user_date ON routes(user_id, route_date);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_visits_session ON visits(session_id);
CREATE INDEX IF NOT EXISTS idx_visits_store ON visits(store_id);
CREATE INDEX IF NOT EXISTS idx_visits_synced ON visits(synced) WHERE synced = FALSE;


