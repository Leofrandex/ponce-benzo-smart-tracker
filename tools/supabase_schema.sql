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

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_routes_user_date ON routes(user_id, route_date);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_visits_session ON visits(session_id);
CREATE INDEX IF NOT EXISTS idx_visits_store ON visits(store_id);
CREATE INDEX IF NOT EXISTS idx_visits_synced ON visits(synced) WHERE synced = FALSE;


