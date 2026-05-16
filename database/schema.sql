-- ============================================================
-- CRE Marketplace - PostgreSQL Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for fuzzy text search

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('tenant', 'landlord', 'admin');
CREATE TYPE profile_status AS ENUM ('draft', 'active', 'paused', 'archived');
CREATE TYPE interest_status AS ENUM ('pending', 'accepted', 'declined', 'expired');
CREATE TYPE message_status AS ENUM ('sent', 'read');
CREATE TYPE funding_status AS ENUM ('bootstrapped', 'angel', 'seed', 'series_a', 'series_b_plus', 'public', 'private_equity');
CREATE TYPE ownership_structure AS ENUM ('sole_proprietor', 'partnership', 'llc', 'corporation', 's_corp', 'franchise');
CREATE TYPE lease_term_pref AS ENUM ('short_term', 'medium_term', 'long_term', 'flexible');
CREATE TYPE space_use_type AS ENUM ('retail', 'office', 'industrial', 'flex', 'medical', 'restaurant', 'mixed');
CREATE TYPE credit_range AS ENUM ('below_600', '600_649', '650_699', '700_749', '750_799', '800_plus');
CREATE TYPE revenue_range AS ENUM ('under_500k', '500k_1m', '1m_5m', '5m_10m', '10m_25m', '25m_plus');
CREATE TYPE document_type AS ENUM ('financial_statement', 'tax_return', 'bank_statement', 'pitch_deck', 'lease_agreement', 'other');
CREATE TYPE event_type AS ENUM (
  'page_view', 'profile_view', 'search', 'filter_applied',
  'interest_expressed', 'message_sent', 'profile_created',
  'profile_updated', 'login', 'register', 'document_uploaded',
  'tenant_saved', 'alert_created'
);

-- ============================================================
-- CORE TABLES
-- ============================================================

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  role            user_role NOT NULL DEFAULT 'tenant',
  first_name      VARCHAR(100),
  last_name       VARCHAR(100),
  phone           VARCHAR(30),
  avatar_url      VARCHAR(500),
  is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================
-- TENANT PROFILES
-- ============================================================

CREATE TABLE tenant_profiles (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status                profile_status NOT NULL DEFAULT 'draft',

  -- Business Info
  legal_name            VARCHAR(255) NOT NULL,
  dba_name              VARCHAR(255),
  industry              VARCHAR(100) NOT NULL,
  sub_industry          VARCHAR(100),
  years_in_operation    INTEGER,
  number_of_locations   INTEGER NOT NULL DEFAULT 1,
  website               VARCHAR(500),
  description           TEXT,
  ownership_structure   ownership_structure,

  -- Space Use
  space_use_type        space_use_type NOT NULL,

  -- Financial & Credibility
  revenue_range         revenue_range,
  credit_score_range    credit_range,
  funding_status        funding_status,
  has_guarantor         BOOLEAN,
  guarantor_details     TEXT,

  -- Privacy flags (tenant controls what's public)
  revenue_visible       BOOLEAN NOT NULL DEFAULT FALSE,
  credit_visible        BOOLEAN NOT NULL DEFAULT FALSE,
  financials_unlockable BOOLEAN NOT NULL DEFAULT TRUE,

  -- Metadata
  profile_completeness  INTEGER NOT NULL DEFAULT 0,  -- 0-100
  view_count            INTEGER NOT NULL DEFAULT 0,
  interest_count        INTEGER NOT NULL DEFAULT 0,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id)
);

CREATE INDEX idx_tenant_profiles_status ON tenant_profiles(status);
CREATE INDEX idx_tenant_profiles_industry ON tenant_profiles(industry);
CREATE INDEX idx_tenant_profiles_space_use ON tenant_profiles(space_use_type);
CREATE INDEX idx_tenant_profiles_revenue ON tenant_profiles(revenue_range);

-- ============================================================
-- TENANT SPACE REQUIREMENTS
-- ============================================================

CREATE TABLE tenant_space_requirements (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_profile_id     UUID NOT NULL REFERENCES tenant_profiles(id) ON DELETE CASCADE,

  -- Location Preferences (NYC neighborhoods)
  preferred_neighborhoods   TEXT[] NOT NULL DEFAULT '{}',
  flexible_on_location      BOOLEAN NOT NULL DEFAULT FALSE,

  -- Size
  sqft_min              INTEGER,
  sqft_max              INTEGER,

  -- Budget
  budget_psf_min        NUMERIC(8,2),
  budget_psf_max        NUMERIC(8,2),
  budget_monthly_min    NUMERIC(10,2),
  budget_monthly_max    NUMERIC(10,2),

  -- Lease
  lease_term_preference lease_term_pref,
  lease_term_years_min  INTEGER,
  lease_term_years_max  INTEGER,
  target_move_in_date   DATE,
  timeline_notes        TEXT,

  -- Amenities & Requirements
  requires_venting        BOOLEAN NOT NULL DEFAULT FALSE,
  requires_frontage       BOOLEAN NOT NULL DEFAULT FALSE,
  requires_elevator       BOOLEAN NOT NULL DEFAULT FALSE,
  requires_parking        BOOLEAN NOT NULL DEFAULT FALSE,
  requires_loading_dock   BOOLEAN NOT NULL DEFAULT FALSE,
  requires_outdoor_space  BOOLEAN NOT NULL DEFAULT FALSE,
  requires_24hr_access    BOOLEAN NOT NULL DEFAULT FALSE,
  additional_amenities    TEXT[],

  -- Operational
  expected_foot_traffic   VARCHAR(100),
  buildout_needs          TEXT,
  uses_heavy_equipment    BOOLEAN NOT NULL DEFAULT FALSE,
  other_requirements      TEXT,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(tenant_profile_id)
);

-- ============================================================
-- LANDLORD PROFILES
-- ============================================================

CREATE TABLE landlord_profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name    VARCHAR(255),
  company_type    VARCHAR(100),   -- owner, broker, REIT, etc.
  bio             TEXT,
  license_number  VARCHAR(100),
  website         VARCHAR(500),
  boroughs        TEXT[],         -- which boroughs they operate in
  is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id)
);

-- ============================================================
-- TENANT SCORES (Proprietary Data Layer)
-- ============================================================

CREATE TABLE tenant_scores (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_profile_id         UUID NOT NULL REFERENCES tenant_profiles(id) ON DELETE CASCADE,

  -- Component Scores (0-100)
  financial_strength_score  INTEGER NOT NULL DEFAULT 0,
  expansion_likelihood_score INTEGER NOT NULL DEFAULT 0,
  operational_stability_score INTEGER NOT NULL DEFAULT 0,
  market_desirability_score INTEGER NOT NULL DEFAULT 0,

  -- Composite
  desirability_index        NUMERIC(5,2) NOT NULL DEFAULT 0,  -- weighted composite

  -- Score breakdown metadata
  score_factors             JSONB,   -- {factor: value, weight: pct, score: pts}
  score_version             INTEGER NOT NULL DEFAULT 1,

  scored_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(tenant_profile_id)
);

CREATE INDEX idx_tenant_scores_desirability ON tenant_scores(desirability_index DESC);

-- ============================================================
-- INTERESTS / OUTREACH
-- ============================================================

CREATE TABLE interest_expressions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  landlord_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_profile_id UUID NOT NULL REFERENCES tenant_profiles(id) ON DELETE CASCADE,
  status            interest_status NOT NULL DEFAULT 'pending',
  message           TEXT,
  landlord_notes    TEXT,
  expires_at        TIMESTAMPTZ,
  responded_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(landlord_id, tenant_profile_id)
);

CREATE INDEX idx_interest_landlord ON interest_expressions(landlord_id);
CREATE INDEX idx_interest_tenant ON interest_expressions(tenant_profile_id);
CREATE INDEX idx_interest_status ON interest_expressions(status);

-- ============================================================
-- MESSAGING
-- ============================================================

CREATE TABLE conversations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  landlord_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject           VARCHAR(255),
  last_message_at   TIMESTAMPTZ,
  is_archived       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(landlord_id, tenant_id)
);

CREATE INDEX idx_conversations_landlord ON conversations(landlord_id);
CREATE INDEX idx_conversations_tenant ON conversations(tenant_id);

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  status          message_status NOT NULL DEFAULT 'sent',
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

-- ============================================================
-- SAVED TENANTS & SEARCH ALERTS
-- ============================================================

CREATE TABLE saved_tenants (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  landlord_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_profile_id UUID NOT NULL REFERENCES tenant_profiles(id) ON DELETE CASCADE,
  notes             TEXT,
  tags              TEXT[],
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(landlord_id, tenant_profile_id)
);

CREATE TABLE search_alerts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  landlord_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  filters         JSONB NOT NULL,   -- serialized filter criteria
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  notify_email    BOOLEAN NOT NULL DEFAULT TRUE,
  frequency       VARCHAR(20) NOT NULL DEFAULT 'daily',  -- 'realtime', 'daily', 'weekly'
  last_run_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_search_alerts_landlord ON search_alerts(landlord_id);
CREATE INDEX idx_search_alerts_active ON search_alerts(is_active);

-- ============================================================
-- DOCUMENTS
-- ============================================================

CREATE TABLE documents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type document_type NOT NULL,
  filename      VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_url      VARCHAR(500),
  file_size     INTEGER,
  mime_type     VARCHAR(100),
  is_public     BOOLEAN NOT NULL DEFAULT FALSE,
  description   TEXT,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_user ON documents(user_id);

-- ============================================================
-- ANALYTICS / DATA WAREHOUSE LAYER
-- ============================================================

-- Raw event stream (structured logging)
CREATE TABLE user_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id  VARCHAR(100),
  event_type  event_type NOT NULL,
  entity_type VARCHAR(50),   -- 'tenant_profile', 'search', 'message', etc.
  entity_id   UUID,
  properties  JSONB,         -- event-specific payload
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_events_user ON user_events(user_id);
CREATE INDEX idx_user_events_type ON user_events(event_type);
CREATE INDEX idx_user_events_created ON user_events(created_at DESC);
CREATE INDEX idx_user_events_entity ON user_events(entity_type, entity_id);

-- Aggregated demand by neighborhood (refreshed periodically)
CREATE TABLE demand_heatmap (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  neighborhood    VARCHAR(100) NOT NULL,
  borough         VARCHAR(50) NOT NULL,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  space_use_type  space_use_type,
  industry        VARCHAR(100),

  -- Demand metrics
  search_count    INTEGER NOT NULL DEFAULT 0,
  active_tenants  INTEGER NOT NULL DEFAULT 0,
  avg_budget_psf  NUMERIC(8,2),
  avg_sqft_need   INTEGER,
  total_sqft_demand BIGINT,

  -- Trend indicators
  wow_change_pct  NUMERIC(5,2),  -- week-over-week
  mom_change_pct  NUMERIC(5,2),  -- month-over-month

  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_heatmap_neighborhood ON demand_heatmap(neighborhood);
CREATE INDEX idx_heatmap_period ON demand_heatmap(period_start, period_end);

-- Aggregated analytics summaries
CREATE TABLE analytics_snapshots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_date   DATE NOT NULL,
  snapshot_type   VARCHAR(50) NOT NULL,  -- 'daily', 'weekly', 'monthly'
  dimensions      JSONB NOT NULL,        -- {industry, neighborhood, space_use, etc.}
  metrics         JSONB NOT NULL,        -- {count, avg_budget, avg_sqft, etc.}
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_snapshots_date ON analytics_snapshots(snapshot_date DESC);
CREATE INDEX idx_snapshots_type ON analytics_snapshots(snapshot_type);

-- ============================================================
-- DEAL PIPELINE (CRM Layer)
-- ============================================================

CREATE TABLE deals (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  landlord_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_profile_id UUID NOT NULL REFERENCES tenant_profiles(id) ON DELETE CASCADE,
  stage             VARCHAR(50) NOT NULL DEFAULT 'prospect',
  -- stages: prospect > contacted > toured > negotiating > loi > lease_signed > closed_lost
  property_address  VARCHAR(255),
  estimated_sqft    INTEGER,
  estimated_rent_psf NUMERIC(8,2),
  estimated_close_date DATE,
  notes             TEXT,
  tags              TEXT[],
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deals_landlord ON deals(landlord_id);
CREATE INDEX idx_deals_stage ON deals(stage);

CREATE TABLE deal_activities (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id     UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity    VARCHAR(100) NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- REFRESH TRIGGERS (updated_at)
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_tenant_profiles_updated_at
  BEFORE UPDATE ON tenant_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_space_req_updated_at
  BEFORE UPDATE ON tenant_space_requirements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_landlord_profiles_updated_at
  BEFORE UPDATE ON landlord_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_tenant_scores_updated_at
  BEFORE UPDATE ON tenant_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- VIEWS
-- ============================================================

-- Full tenant card (for landlord search results)
CREATE VIEW tenant_search_view AS
SELECT
  tp.id AS profile_id,
  tp.user_id,
  tp.status,
  tp.legal_name,
  tp.dba_name,
  tp.industry,
  tp.sub_industry,
  tp.space_use_type,
  tp.years_in_operation,
  tp.number_of_locations,
  tp.website,
  tp.description,
  tp.ownership_structure,
  tp.revenue_range,
  tp.credit_score_range,
  tp.funding_status,
  tp.has_guarantor,
  tp.revenue_visible,
  tp.credit_visible,
  tp.financials_unlockable,
  tp.profile_completeness,
  tp.view_count,
  tp.interest_count,
  -- Space requirements
  tsr.preferred_neighborhoods,
  tsr.sqft_min,
  tsr.sqft_max,
  tsr.budget_psf_min,
  tsr.budget_psf_max,
  tsr.budget_monthly_min,
  tsr.budget_monthly_max,
  tsr.lease_term_preference,
  tsr.target_move_in_date,
  tsr.requires_venting,
  tsr.requires_frontage,
  tsr.requires_elevator,
  tsr.requires_parking,
  -- Scores
  ts.financial_strength_score,
  ts.expansion_likelihood_score,
  ts.market_desirability_score,
  ts.desirability_index,
  -- User info
  u.first_name,
  u.last_name,
  u.avatar_url,
  tp.created_at,
  tp.updated_at
FROM tenant_profiles tp
JOIN users u ON u.id = tp.user_id
LEFT JOIN tenant_space_requirements tsr ON tsr.tenant_profile_id = tp.id
LEFT JOIN tenant_scores ts ON ts.tenant_profile_id = tp.id
WHERE tp.status = 'active' AND u.is_active = TRUE;
