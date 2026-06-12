-- ============================================================
-- CRE Marketplace - Idempotent Database Schema Update
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Enums (Safe Creation)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('tenant', 'landlord', 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'profile_status') THEN
    CREATE TYPE profile_status AS ENUM ('draft', 'active', 'paused', 'archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'interest_status') THEN
    CREATE TYPE interest_status AS ENUM ('pending', 'accepted', 'declined', 'expired');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_status') THEN
    CREATE TYPE message_status AS ENUM ('sent', 'read');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'funding_status') THEN
    CREATE TYPE funding_status AS ENUM ('bootstrapped', 'angel', 'seed', 'series_a', 'series_b_plus', 'public', 'private_equity');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ownership_structure') THEN
    CREATE TYPE ownership_structure AS ENUM ('sole_proprietor', 'partnership', 'llc', 'corporation', 's_corp', 'franchise');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lease_term_pref') THEN
    CREATE TYPE lease_term_pref AS ENUM ('short_term', 'medium_term', 'long_term', 'flexible');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'space_use_type') THEN
    CREATE TYPE space_use_type AS ENUM ('retail', 'office', 'industrial', 'flex', 'medical', 'restaurant', 'mixed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credit_range') THEN
    CREATE TYPE credit_range AS ENUM ('below_600', '600_649', '650_699', '700_749', '750_799', '800_plus');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'revenue_range') THEN
    CREATE TYPE revenue_range AS ENUM ('under_500k', '500k_1m', '1m_5m', '5m_10m', '10m_25m', '25m_plus');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_type') THEN
    CREATE TYPE document_type AS ENUM ('financial_statement', 'tax_return', 'bank_statement', 'pitch_deck', 'lease_agreement', 'other');
  END IF;
END$$;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
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

-- 2. Tenant Requirements Table
CREATE TABLE IF NOT EXISTS tenant_requirements (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID REFERENCES users(id) ON DELETE SET NULL,
  source                  TEXT,
  source_lead_id          TEXT,
  full_name               TEXT,
  email                   TEXT,
  phone                   TEXT,
  business_type           TEXT,
  concept_description      TEXT,
  other_business_type     TEXT,
  operating_status        TEXT,
  location_count          INTEGER DEFAULT 1,
  boroughs                JSONB DEFAULT '[]'::jsonb,
  neighborhoods           JSONB DEFAULT '[]'::jsonb,
  location_flexibility    TEXT,
  space_types             JSONB DEFAULT '[]'::jsonb,
  min_square_feet         INTEGER,
  max_square_feet         INTEGER,
  ideal_square_feet       INTEGER,
  square_feet_range_label TEXT,
  min_monthly_budget      INTEGER,
  max_monthly_budget      INTEGER,
  budget_range_label      TEXT,
  budget_flexibility      TEXT,
  move_timeline_label     TEXT,
  target_move_start_date  DATE,
  target_move_end_date    DATE,
  urgency_status          TEXT,
  ideal_space_description TEXT,
  contact_permission      BOOLEAN DEFAULT FALSE,
  status                  TEXT DEFAULT 'New',
  freshness_status        TEXT DEFAULT 'Fresh',
  last_confirmed_at       TIMESTAMPTZ DEFAULT NOW(),
  raw_payload             JSONB,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe Alterations for tenant_requirements Columns
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS source_lead_id TEXT;
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS business_type TEXT;
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS concept_description TEXT;
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS other_business_type TEXT;
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS operating_status TEXT;
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS location_count INTEGER DEFAULT 1;
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS boroughs JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS neighborhoods JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS location_flexibility TEXT;
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS space_types JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS min_square_feet INTEGER;
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS max_square_feet INTEGER;
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS ideal_square_feet INTEGER;
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS square_feet_range_label TEXT;
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS min_monthly_budget INTEGER;
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS max_monthly_budget INTEGER;
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS budget_range_label TEXT;
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS budget_flexibility TEXT;
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS move_timeline_label TEXT;
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS target_move_start_date DATE;
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS target_move_end_date DATE;
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS urgency_status TEXT;
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS ideal_space_description TEXT;
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS contact_permission BOOLEAN DEFAULT FALSE;
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'New';
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS freshness_status TEXT DEFAULT 'Fresh';
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS last_confirmed_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS raw_payload JSONB;
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE tenant_requirements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Enforce Defaults in case table existed without them
ALTER TABLE tenant_requirements ALTER COLUMN location_count SET DEFAULT 1;
ALTER TABLE tenant_requirements ALTER COLUMN boroughs SET DEFAULT '[]'::jsonb;
ALTER TABLE tenant_requirements ALTER COLUMN neighborhoods SET DEFAULT '[]'::jsonb;
ALTER TABLE tenant_requirements ALTER COLUMN space_types SET DEFAULT '[]'::jsonb;
ALTER TABLE tenant_requirements ALTER COLUMN contact_permission SET DEFAULT FALSE;
ALTER TABLE tenant_requirements ALTER COLUMN status SET DEFAULT 'New';
ALTER TABLE tenant_requirements ALTER COLUMN freshness_status SET DEFAULT 'Fresh';
ALTER TABLE tenant_requirements ALTER COLUMN last_confirmed_at SET DEFAULT NOW();
ALTER TABLE tenant_requirements ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE tenant_requirements ALTER COLUMN updated_at SET DEFAULT NOW();

-- 3. Meta Leads Table
CREATE TABLE IF NOT EXISTS meta_leads (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meta_lead_id            TEXT UNIQUE NOT NULL,
  created_time            TIMESTAMPTZ,
  ad_id                   TEXT,
  ad_name                 TEXT,
  adset_id                TEXT,
  adset_name              TEXT,
  campaign_id             TEXT,
  campaign_name           TEXT,
  form_id                 TEXT,
  form_name               TEXT,
  platform                TEXT,
  is_organic              BOOLEAN,
  full_name               TEXT,
  email                   TEXT NOT NULL,
  phone_number            TEXT,
  business_type           TEXT,
  currently_operating     TEXT,
  desired_location        TEXT,
  space_type              TEXT,
  space_size              TEXT,
  monthly_budget          TEXT,
  move_timeline           TEXT,
  wants_contact           BOOLEAN,
  ideal_space_description TEXT,
  lead_status             TEXT DEFAULT 'new',
  raw_payload             JSONB,
  user_id                 UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe Alterations for meta_leads Columns
ALTER TABLE meta_leads ADD COLUMN IF NOT EXISTS created_time TIMESTAMPTZ;
ALTER TABLE meta_leads ADD COLUMN IF NOT EXISTS ad_id TEXT;
ALTER TABLE meta_leads ADD COLUMN IF NOT EXISTS ad_name TEXT;
ALTER TABLE meta_leads ADD COLUMN IF NOT EXISTS adset_id TEXT;
ALTER TABLE meta_leads ADD COLUMN IF NOT EXISTS adset_name TEXT;
ALTER TABLE meta_leads ADD COLUMN IF NOT EXISTS campaign_id TEXT;
ALTER TABLE meta_leads ADD COLUMN IF NOT EXISTS campaign_name TEXT;
ALTER TABLE meta_leads ADD COLUMN IF NOT EXISTS form_id TEXT;
ALTER TABLE meta_leads ADD COLUMN IF NOT EXISTS form_name TEXT;
ALTER TABLE meta_leads ADD COLUMN IF NOT EXISTS platform TEXT;
ALTER TABLE meta_leads ADD COLUMN IF NOT EXISTS is_organic BOOLEAN;
ALTER TABLE meta_leads ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE meta_leads ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE meta_leads ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE meta_leads ADD COLUMN IF NOT EXISTS business_type TEXT;
ALTER TABLE meta_leads ADD COLUMN IF NOT EXISTS currently_operating TEXT;
ALTER TABLE meta_leads ADD COLUMN IF NOT EXISTS desired_location TEXT;
ALTER TABLE meta_leads ADD COLUMN IF NOT EXISTS space_type TEXT;
ALTER TABLE meta_leads ADD COLUMN IF NOT EXISTS space_size TEXT;
ALTER TABLE meta_leads ADD COLUMN IF NOT EXISTS monthly_budget TEXT;
ALTER TABLE meta_leads ADD COLUMN IF NOT EXISTS move_timeline TEXT;
ALTER TABLE meta_leads ADD COLUMN IF NOT EXISTS wants_contact BOOLEAN;
ALTER TABLE meta_leads ADD COLUMN IF NOT EXISTS ideal_space_description TEXT;
ALTER TABLE meta_leads ADD COLUMN IF NOT EXISTS lead_status TEXT DEFAULT 'new';
ALTER TABLE meta_leads ADD COLUMN IF NOT EXISTS raw_payload JSONB;
ALTER TABLE meta_leads ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE meta_leads ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE meta_leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Account Activations Table
CREATE TABLE IF NOT EXISTS account_activations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  token         TEXT NOT NULL,
  is_completed  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);

ALTER TABLE account_activations ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
ALTER TABLE account_activations ADD COLUMN IF NOT EXISTS token TEXT;
ALTER TABLE account_activations ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE account_activations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE account_activations ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days');

-- 5. Tenant Matches Table
CREATE TABLE IF NOT EXISTS tenant_matches (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id             UUID REFERENCES meta_leads(id) ON DELETE CASCADE,
  requirement_id      UUID REFERENCES tenant_requirements(id) ON DELETE CASCADE,
  listing_title       TEXT,
  listing_url         TEXT NOT NULL,
  address             TEXT,
  city                TEXT,
  state               TEXT,
  neighborhood        TEXT,
  square_feet         TEXT,
  rent                TEXT,
  space_type          TEXT,
  broker_name         TEXT,
  broker_phone        TEXT,
  broker_email        TEXT,
  source              TEXT DEFAULT 'manual',
  admin_notes         TEXT,
  match_score         INTEGER,
  verification_status TEXT DEFAULT 'needs_review',
  tenant_sent         BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tenant_matches ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES meta_leads(id) ON DELETE CASCADE;
ALTER TABLE tenant_matches ADD COLUMN IF NOT EXISTS requirement_id UUID REFERENCES tenant_requirements(id) ON DELETE CASCADE;
ALTER TABLE tenant_matches ADD COLUMN IF NOT EXISTS listing_title TEXT;
ALTER TABLE tenant_matches ADD COLUMN IF NOT EXISTS listing_url TEXT;
ALTER TABLE tenant_matches ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE tenant_matches ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE tenant_matches ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE tenant_matches ADD COLUMN IF NOT EXISTS neighborhood TEXT;
ALTER TABLE tenant_matches ADD COLUMN IF NOT EXISTS square_feet TEXT;
ALTER TABLE tenant_matches ADD COLUMN IF NOT EXISTS rent TEXT;
ALTER TABLE tenant_matches ADD COLUMN IF NOT EXISTS space_type TEXT;
ALTER TABLE tenant_matches ADD COLUMN IF NOT EXISTS broker_name TEXT;
ALTER TABLE tenant_matches ADD COLUMN IF NOT EXISTS broker_phone TEXT;
ALTER TABLE tenant_matches ADD COLUMN IF NOT EXISTS broker_email TEXT;
ALTER TABLE tenant_matches ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE tenant_matches ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE tenant_matches ADD COLUMN IF NOT EXISTS match_score INTEGER;
ALTER TABLE tenant_matches ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'needs_review';
ALTER TABLE tenant_matches ADD COLUMN IF NOT EXISTS tenant_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE tenant_matches ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE tenant_matches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_tenant_requirements_email_lower ON tenant_requirements (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_tenant_requirements_user_id ON tenant_requirements (user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_requirements_status ON tenant_requirements (status);
CREATE INDEX IF NOT EXISTS idx_tenant_requirements_freshness ON tenant_requirements (freshness_status);
CREATE INDEX IF NOT EXISTS idx_tenant_requirements_business_type ON tenant_requirements (business_type);
CREATE INDEX IF NOT EXISTS idx_tenant_requirements_operating_status ON tenant_requirements (operating_status);

CREATE INDEX IF NOT EXISTS idx_meta_leads_email_lower ON meta_leads (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_meta_leads_user_id ON meta_leads (user_id);

CREATE INDEX IF NOT EXISTS idx_tenant_matches_lead_id ON tenant_matches (lead_id);
CREATE INDEX IF NOT EXISTS idx_tenant_matches_requirement_id ON tenant_matches (requirement_id);

-- 7. Triggers Setup
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenant_requirements_updated_at ON tenant_requirements;
CREATE TRIGGER trg_tenant_requirements_updated_at
  BEFORE UPDATE ON tenant_requirements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_meta_leads_updated_at ON meta_leads;
CREATE TRIGGER trg_meta_leads_updated_at
  BEFORE UPDATE ON meta_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_tenant_matches_updated_at ON tenant_matches;
CREATE TRIGGER trg_tenant_matches_updated_at
  BEFORE UPDATE ON tenant_matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 8. Data Backfills & Normalization

-- Enforce valid JSONB arrays
UPDATE tenant_requirements
SET boroughs = '[]'::jsonb
WHERE boroughs IS NULL OR jsonb_typeof(boroughs) <> 'array';

UPDATE tenant_requirements
SET neighborhoods = '[]'::jsonb
WHERE neighborhoods IS NULL OR jsonb_typeof(neighborhoods) <> 'array';

UPDATE tenant_requirements
SET space_types = '[]'::jsonb
WHERE space_types IS NULL OR jsonb_typeof(space_types) <> 'array';

-- Enforce default values on NULL fields
UPDATE tenant_requirements SET contact_permission = FALSE WHERE contact_permission IS NULL;
UPDATE tenant_requirements SET status = 'New' WHERE status IS NULL;
UPDATE tenant_requirements SET location_count = 1 WHERE location_count IS NULL;

-- Initialize last_confirmed_at
UPDATE tenant_requirements
SET last_confirmed_at = COALESCE(updated_at, created_at, NOW())
WHERE last_confirmed_at IS NULL;

-- Recalculate freshness_status
UPDATE tenant_requirements
SET freshness_status = CASE
  WHEN EXTRACT(DAY FROM NOW() - last_confirmed_at) <= 30 THEN 'Fresh'
  WHEN EXTRACT(DAY FROM NOW() - last_confirmed_at) <= 90 THEN 'Warm'
  WHEN EXTRACT(DAY FROM NOW() - last_confirmed_at) <= 180 THEN 'Aging'
  ELSE 'Stale'
END
WHERE freshness_status IS NULL;

-- Normalize tenant_requirements.operating_status
UPDATE tenant_requirements
SET operating_status = CASE
  -- Direct matches
  WHEN LOWER(TRIM(operating_status)) IN ('starting', 'conceptual concept', 'concept', 'planning') THEN 'Concept / Planning'
  WHEN LOWER(TRIM(operating_status)) IN ('launching first location', 'first location', 'opening first location') THEN 'Opening First Location'
  WHEN LOWER(TRIM(operating_status)) IN ('existing business', 'currently operating', 'operating') THEN 'Currently Operating'
  WHEN LOWER(TRIM(operating_status)) IN ('expanding') THEN 'Expanding To New Location'
  WHEN LOWER(TRIM(operating_status)) IN ('relocating existing business', 'relocating', 'relocation') THEN 'Relocating Existing Business'
  WHEN LOWER(TRIM(operating_status)) IN ('franchise operator', 'franchise') THEN 'Franchise Operator'
  WHEN LOWER(TRIM(operating_status)) IN ('other') THEN 'Other'
  
  -- Fuzzy matches
  WHEN LOWER(TRIM(operating_status)) LIKE '%concept%' OR LOWER(TRIM(operating_status)) LIKE '%plan%' OR LOWER(TRIM(operating_status)) LIKE '%start%' THEN 'Concept / Planning'
  WHEN LOWER(TRIM(operating_status)) LIKE '%first location%' OR LOWER(TRIM(operating_status)) LIKE '%opening first%' OR LOWER(TRIM(operating_status)) LIKE '%launching first%' THEN 'Opening First Location'
  WHEN LOWER(TRIM(operating_status)) LIKE '%currently%' OR LOWER(TRIM(operating_status)) LIKE '%existing%' OR LOWER(TRIM(operating_status)) LIKE '%operating%' THEN 'Currently Operating'
  WHEN LOWER(TRIM(operating_status)) LIKE '%expanding%' OR LOWER(TRIM(operating_status)) LIKE '%expand%' THEN 'Expanding To New Location'
  WHEN LOWER(TRIM(operating_status)) LIKE '%relocating%' OR LOWER(TRIM(operating_status)) LIKE '%relocation%' THEN 'Relocating Existing Business'
  WHEN LOWER(TRIM(operating_status)) LIKE '%franchise%' THEN 'Franchise Operator'
  
  -- Default fallback
  ELSE 'Other'
END
WHERE operating_status IS NOT NULL;

UPDATE tenant_requirements
SET operating_status = 'Other'
WHERE operating_status IS NULL;

-- Normalize meta_leads.currently_operating
UPDATE meta_leads
SET currently_operating = CASE
  -- Direct matches
  WHEN LOWER(TRIM(currently_operating)) IN ('starting', 'conceptual concept', 'concept', 'planning') THEN 'Concept / Planning'
  WHEN LOWER(TRIM(currently_operating)) IN ('launching first location', 'first location', 'opening first location') THEN 'Opening First Location'
  WHEN LOWER(TRIM(currently_operating)) IN ('existing business', 'currently operating', 'operating') THEN 'Currently Operating'
  WHEN LOWER(TRIM(currently_operating)) IN ('expanding') THEN 'Expanding To New Location'
  WHEN LOWER(TRIM(currently_operating)) IN ('relocating existing business', 'relocating', 'relocation') THEN 'Relocating Existing Business'
  WHEN LOWER(TRIM(currently_operating)) IN ('franchise operator', 'franchise') THEN 'Franchise Operator'
  WHEN LOWER(TRIM(currently_operating)) IN ('other') THEN 'Other'
  
  -- Fuzzy matches
  WHEN LOWER(TRIM(currently_operating)) LIKE '%concept%' OR LOWER(TRIM(currently_operating)) LIKE '%plan%' OR LOWER(TRIM(currently_operating)) LIKE '%start%' THEN 'Concept / Planning'
  WHEN LOWER(TRIM(currently_operating)) LIKE '%first location%' OR LOWER(TRIM(currently_operating)) LIKE '%opening first%' OR LOWER(TRIM(currently_operating)) LIKE '%launching first%' THEN 'Opening First Location'
  WHEN LOWER(TRIM(currently_operating)) LIKE '%currently%' OR LOWER(TRIM(currently_operating)) LIKE '%existing%' OR LOWER(TRIM(currently_operating)) LIKE '%operating%' THEN 'Currently Operating'
  WHEN LOWER(TRIM(currently_operating)) LIKE '%expanding%' OR LOWER(TRIM(currently_operating)) LIKE '%expand%' THEN 'Expanding To New Location'
  WHEN LOWER(TRIM(currently_operating)) LIKE '%relocating%' OR LOWER(TRIM(currently_operating)) LIKE '%relocation%' THEN 'Relocating Existing Business'
  WHEN LOWER(TRIM(currently_operating)) LIKE '%franchise%' THEN 'Franchise Operator'
  
  -- Default fallback
  ELSE 'Other'
END
WHERE currently_operating IS NOT NULL;

UPDATE meta_leads
SET currently_operating = 'Other'
WHERE currently_operating IS NULL;

-- Normalize tenant_requirements.business_type
UPDATE tenant_requirements
SET business_type = CASE
  -- Direct matches
  WHEN LOWER(TRIM(business_type)) IN ('restaurant', 'food service', 'restaurant / food service') THEN 'Restaurant / Food Service'
  WHEN LOWER(TRIM(business_type)) IN ('cafe', 'coffee', 'bakery', 'coffee shop', 'cafe / coffee / bakery') THEN 'Cafe / Coffee / Bakery'
  WHEN LOWER(TRIM(business_type)) IN ('retail') THEN 'Retail'
  WHEN LOWER(TRIM(business_type)) IN ('fitness', 'wellness', 'gym', 'yoga', 'pilates', 'pilates studio', 'fitness / wellness') THEN 'Fitness / Wellness'
  WHEN LOWER(TRIM(business_type)) IN ('medical', 'dental', 'medical / dental') THEN 'Medical / Dental'
  WHEN LOWER(TRIM(business_type)) IN ('beauty', 'spa', 'med spa', 'beauty / med spa') THEN 'Beauty / Med Spa'
  WHEN LOWER(TRIM(business_type)) IN ('office') THEN 'Office'
  WHEN LOWER(TRIM(business_type)) IN ('childcare', 'education', 'childcare / education') THEN 'Childcare / Education'
  WHEN LOWER(TRIM(business_type)) IN ('entertainment', 'experiential', 'entertainment / experiential') THEN 'Entertainment / Experiential'
  WHEN LOWER(TRIM(business_type)) IN ('industrial', 'warehouse', 'industrial / warehouse') THEN 'Industrial / Warehouse'
  WHEN LOWER(TRIM(business_type)) IN ('hotel', 'hospitality', 'hotel / hospitality') THEN 'Hotel / Hospitality'
  
  -- Substring checks
  WHEN LOWER(TRIM(business_type)) LIKE '%restaurant%' OR LOWER(TRIM(business_type)) LIKE '%food%' OR LOWER(TRIM(business_type)) LIKE '%dining%' OR LOWER(TRIM(business_type)) LIKE '%eatery%' OR LOWER(TRIM(business_type)) LIKE '%bar%' OR LOWER(TRIM(business_type)) LIKE '%fast casual%' OR LOWER(TRIM(business_type)) LIKE '%bistro%' OR LOWER(TRIM(business_type)) LIKE '%kitchen%' OR LOWER(TRIM(business_type)) LIKE '%catering%' THEN 'Restaurant / Food Service'
  WHEN LOWER(TRIM(business_type)) LIKE '%cafe%' OR LOWER(TRIM(business_type)) LIKE '%coffee%' OR LOWER(TRIM(business_type)) LIKE '%bakery%' OR LOWER(TRIM(business_type)) LIKE '%donut%' OR LOWER(TRIM(business_type)) LIKE '%juice%' OR LOWER(TRIM(business_type)) LIKE '%smoothie%' OR LOWER(TRIM(business_type)) LIKE '%tea%' OR LOWER(TRIM(business_type)) LIKE '%deli%' THEN 'Cafe / Coffee / Bakery'
  WHEN LOWER(TRIM(business_type)) LIKE '%fitness%' OR LOWER(TRIM(business_type)) LIKE '%gym%' OR LOWER(TRIM(business_type)) LIKE '%yoga%' OR LOWER(TRIM(business_type)) LIKE '%pilates%' OR LOWER(TRIM(business_type)) LIKE '%crossfit%' OR LOWER(TRIM(business_type)) LIKE '%wellness%' OR LOWER(TRIM(business_type)) LIKE '%workout%' OR LOWER(TRIM(business_type)) LIKE '%spin%' OR LOWER(TRIM(business_type)) LIKE '%cycle%' OR LOWER(TRIM(business_type)) LIKE '%dance%' OR LOWER(TRIM(business_type)) LIKE '%personal training%' THEN 'Fitness / Wellness'
  WHEN LOWER(TRIM(business_type)) LIKE '%medical%' OR LOWER(TRIM(business_type)) LIKE '%dental%' OR LOWER(TRIM(business_type)) LIKE '%doctor%' OR LOWER(TRIM(business_type)) LIKE '%dentist%' OR LOWER(TRIM(business_type)) LIKE '%clinic%' OR LOWER(TRIM(business_type)) LIKE '%hospital%' OR LOWER(TRIM(business_type)) LIKE '%physio%' OR LOWER(TRIM(business_type)) LIKE '%therapy%' OR LOWER(TRIM(business_type)) LIKE '%chiropractic%' OR LOWER(TRIM(business_type)) LIKE '%urgent care%' THEN 'Medical / Dental'
  WHEN LOWER(TRIM(business_type)) LIKE '%beauty%' OR LOWER(TRIM(business_type)) LIKE '%spa%' OR LOWER(TRIM(business_type)) LIKE '%salon%' OR LOWER(TRIM(business_type)) LIKE '%nail%' OR LOWER(TRIM(business_type)) LIKE '%hair%' OR LOWER(TRIM(business_type)) LIKE '%barber%' OR LOWER(TRIM(business_type)) LIKE '%cosmetic%' OR LOWER(TRIM(business_type)) LIKE '%medspa%' OR LOWER(TRIM(business_type)) LIKE '%skincare%' OR LOWER(TRIM(business_type)) LIKE '%massage%' THEN 'Beauty / Med Spa'
  WHEN LOWER(TRIM(business_type)) LIKE '%retail%' OR LOWER(TRIM(business_type)) LIKE '%store%' OR LOWER(TRIM(business_type)) LIKE '%shop%' OR LOWER(TRIM(business_type)) LIKE '%boutique%' OR LOWER(TRIM(business_type)) LIKE '%market%' OR LOWER(TRIM(business_type)) LIKE '%grocery%' OR LOWER(TRIM(business_type)) LIKE '%apparel%' OR LOWER(TRIM(business_type)) LIKE '%fashion%' OR LOWER(TRIM(business_type)) LIKE '%clothing%' THEN 'Retail'
  WHEN LOWER(TRIM(business_type)) LIKE '%office%' OR LOWER(TRIM(business_type)) LIKE '%corporate%' OR LOWER(TRIM(business_type)) LIKE '%hq%' OR LOWER(TRIM(business_type)) LIKE '%agency%' OR LOWER(TRIM(business_type)) LIKE '%studio%' OR LOWER(TRIM(business_type)) LIKE '%coworking%' OR LOWER(TRIM(business_type)) LIKE '%consulting%' OR LOWER(TRIM(business_type)) LIKE '%finance%' OR LOWER(TRIM(business_type)) LIKE '%banking%' OR LOWER(TRIM(business_type)) LIKE '%insurance%' OR LOWER(TRIM(business_type)) LIKE '%technology%' OR LOWER(TRIM(business_type)) LIKE '%tech%' OR LOWER(TRIM(business_type)) LIKE '%software%' OR LOWER(TRIM(business_type)) LIKE '%legal%' OR LOWER(TRIM(business_type)) LIKE '%law%' THEN 'Office'
  WHEN LOWER(TRIM(business_type)) LIKE '%childcare%' OR LOWER(TRIM(business_type)) LIKE '%daycare%' OR LOWER(TRIM(business_type)) LIKE '%education%' OR LOWER(TRIM(business_type)) LIKE '%school%' OR LOWER(TRIM(business_type)) LIKE '%academy%' OR LOWER(TRIM(business_type)) LIKE '%preschool%' OR LOWER(TRIM(business_type)) LIKE '%learning%' OR LOWER(TRIM(business_type)) LIKE '%tutor%' OR LOWER(TRIM(business_type)) LIKE '%nursery%' THEN 'Childcare / Education'
  WHEN LOWER(TRIM(business_type)) LIKE '%entertainment%' OR LOWER(TRIM(business_type)) LIKE '%experiential%' OR LOWER(TRIM(business_type)) LIKE '%event%' OR LOWER(TRIM(business_type)) LIKE '%theater%' OR LOWER(TRIM(business_type)) LIKE '%cinema%' OR LOWER(TRIM(business_type)) LIKE '%gallery%' OR LOWER(TRIM(business_type)) LIKE '%museum%' OR LOWER(TRIM(business_type)) LIKE '%arcade%' OR LOWER(TRIM(business_type)) LIKE '%play%' OR LOWER(TRIM(business_type)) LIKE '%recreation%' OR LOWER(TRIM(business_type)) LIKE '%music%' THEN 'Entertainment / Experiential'
  WHEN LOWER(TRIM(business_type)) LIKE '%industrial%' OR LOWER(TRIM(business_type)) LIKE '%warehouse%' OR LOWER(TRIM(business_type)) LIKE '%logistics%' OR LOWER(TRIM(business_type)) LIKE '%distribution%' OR LOWER(TRIM(business_type)) LIKE '%storage%' OR LOWER(TRIM(business_type)) LIKE '%manufacturing%' OR LOWER(TRIM(business_type)) LIKE '%factory%' OR LOWER(TRIM(business_type)) LIKE '%auto%' OR LOWER(TRIM(business_type)) LIKE '%repair%' THEN 'Industrial / Warehouse'
  WHEN LOWER(TRIM(business_type)) LIKE '%hotel%' OR LOWER(TRIM(business_type)) LIKE '%hospitality%' OR LOWER(TRIM(business_type)) LIKE '%motel%' OR LOWER(TRIM(business_type)) LIKE '%hostel%' OR LOWER(TRIM(business_type)) LIKE '%inn%' OR LOWER(TRIM(business_type)) LIKE '%lodging%' THEN 'Hotel / Hospitality'
  
  -- Default fallback
  ELSE 'Other'
END
WHERE business_type IS NOT NULL;

UPDATE tenant_requirements
SET business_type = 'Other'
WHERE business_type IS NULL;

-- Normalize meta_leads.business_type
UPDATE meta_leads
SET business_type = CASE
  -- Direct matches
  WHEN LOWER(TRIM(business_type)) IN ('restaurant', 'food service', 'restaurant / food service') THEN 'Restaurant / Food Service'
  WHEN LOWER(TRIM(business_type)) IN ('cafe', 'coffee', 'bakery', 'coffee shop', 'cafe / coffee / bakery') THEN 'Cafe / Coffee / Bakery'
  WHEN LOWER(TRIM(business_type)) IN ('retail') THEN 'Retail'
  WHEN LOWER(TRIM(business_type)) IN ('fitness', 'wellness', 'gym', 'yoga', 'pilates', 'pilates studio', 'fitness / wellness') THEN 'Fitness / Wellness'
  WHEN LOWER(TRIM(business_type)) IN ('medical', 'dental', 'medical / dental') THEN 'Medical / Dental'
  WHEN LOWER(TRIM(business_type)) IN ('beauty', 'spa', 'med spa', 'beauty / med spa') THEN 'Beauty / Med Spa'
  WHEN LOWER(TRIM(business_type)) IN ('office') THEN 'Office'
  WHEN LOWER(TRIM(business_type)) IN ('childcare', 'education', 'childcare / education') THEN 'Childcare / Education'
  WHEN LOWER(TRIM(business_type)) IN ('entertainment', 'experiential', 'entertainment / experiential') THEN 'Entertainment / Experiential'
  WHEN LOWER(TRIM(business_type)) IN ('industrial', 'warehouse', 'industrial / warehouse') THEN 'Industrial / Warehouse'
  WHEN LOWER(TRIM(business_type)) IN ('hotel', 'hospitality', 'hotel / hospitality') THEN 'Hotel / Hospitality'
  
  -- Substring checks
  WHEN LOWER(TRIM(business_type)) LIKE '%restaurant%' OR LOWER(TRIM(business_type)) LIKE '%food%' OR LOWER(TRIM(business_type)) LIKE '%dining%' OR LOWER(TRIM(business_type)) LIKE '%eatery%' OR LOWER(TRIM(business_type)) LIKE '%bar%' OR LOWER(TRIM(business_type)) LIKE '%fast casual%' OR LOWER(TRIM(business_type)) LIKE '%bistro%' OR LOWER(TRIM(business_type)) LIKE '%kitchen%' OR LOWER(TRIM(business_type)) LIKE '%catering%' THEN 'Restaurant / Food Service'
  WHEN LOWER(TRIM(business_type)) LIKE '%cafe%' OR LOWER(TRIM(business_type)) LIKE '%coffee%' OR LOWER(TRIM(business_type)) LIKE '%bakery%' OR LOWER(TRIM(business_type)) LIKE '%donut%' OR LOWER(TRIM(business_type)) LIKE '%juice%' OR LOWER(TRIM(business_type)) LIKE '%smoothie%' OR LOWER(TRIM(business_type)) LIKE '%tea%' OR LOWER(TRIM(business_type)) LIKE '%deli%' THEN 'Cafe / Coffee / Bakery'
  WHEN LOWER(TRIM(business_type)) LIKE '%fitness%' OR LOWER(TRIM(business_type)) LIKE '%gym%' OR LOWER(TRIM(business_type)) LIKE '%yoga%' OR LOWER(TRIM(business_type)) LIKE '%pilates%' OR LOWER(TRIM(business_type)) LIKE '%crossfit%' OR LOWER(TRIM(business_type)) LIKE '%wellness%' OR LOWER(TRIM(business_type)) LIKE '%workout%' OR LOWER(TRIM(business_type)) LIKE '%spin%' OR LOWER(TRIM(business_type)) LIKE '%cycle%' OR LOWER(TRIM(business_type)) LIKE '%dance%' OR LOWER(TRIM(business_type)) LIKE '%personal training%' THEN 'Fitness / Wellness'
  WHEN LOWER(TRIM(business_type)) LIKE '%medical%' OR LOWER(TRIM(business_type)) LIKE '%dental%' OR LOWER(TRIM(business_type)) LIKE '%doctor%' OR LOWER(TRIM(business_type)) LIKE '%dentist%' OR LOWER(TRIM(business_type)) LIKE '%clinic%' OR LOWER(TRIM(business_type)) LIKE '%hospital%' OR LOWER(TRIM(business_type)) LIKE '%physio%' OR LOWER(TRIM(business_type)) LIKE '%therapy%' OR LOWER(TRIM(business_type)) LIKE '%chiropractic%' OR LOWER(TRIM(business_type)) LIKE '%urgent care%' THEN 'Medical / Dental'
  WHEN LOWER(TRIM(business_type)) LIKE '%beauty%' OR LOWER(TRIM(business_type)) LIKE '%spa%' OR LOWER(TRIM(business_type)) LIKE '%salon%' OR LOWER(TRIM(business_type)) LIKE '%nail%' OR LOWER(TRIM(business_type)) LIKE '%hair%' OR LOWER(TRIM(business_type)) LIKE '%barber%' OR LOWER(TRIM(business_type)) LIKE '%cosmetic%' OR LOWER(TRIM(business_type)) LIKE '%medspa%' OR LOWER(TRIM(business_type)) LIKE '%skincare%' OR LOWER(TRIM(business_type)) LIKE '%massage%' THEN 'Beauty / Med Spa'
  WHEN LOWER(TRIM(business_type)) LIKE '%retail%' OR LOWER(TRIM(business_type)) LIKE '%store%' OR LOWER(TRIM(business_type)) LIKE '%shop%' OR LOWER(TRIM(business_type)) LIKE '%boutique%' OR LOWER(TRIM(business_type)) LIKE '%market%' OR LOWER(TRIM(business_type)) LIKE '%grocery%' OR LOWER(TRIM(business_type)) LIKE '%apparel%' OR LOWER(TRIM(business_type)) LIKE '%fashion%' OR LOWER(TRIM(business_type)) LIKE '%clothing%' THEN 'Retail'
  WHEN LOWER(TRIM(business_type)) LIKE '%office%' OR LOWER(TRIM(business_type)) LIKE '%corporate%' OR LOWER(TRIM(business_type)) LIKE '%hq%' OR LOWER(TRIM(business_type)) LIKE '%agency%' OR LOWER(TRIM(business_type)) LIKE '%studio%' OR LOWER(TRIM(business_type)) LIKE '%coworking%' OR LOWER(TRIM(business_type)) LIKE '%consulting%' OR LOWER(TRIM(business_type)) LIKE '%finance%' OR LOWER(TRIM(business_type)) LIKE '%banking%' OR LOWER(TRIM(business_type)) LIKE '%insurance%' OR LOWER(TRIM(business_type)) LIKE '%technology%' OR LOWER(TRIM(business_type)) LIKE '%tech%' OR LOWER(TRIM(business_type)) LIKE '%software%' OR LOWER(TRIM(business_type)) LIKE '%legal%' OR LOWER(TRIM(business_type)) LIKE '%law%' THEN 'Office'
  WHEN LOWER(TRIM(business_type)) LIKE '%childcare%' OR LOWER(TRIM(business_type)) LIKE '%daycare%' OR LOWER(TRIM(business_type)) LIKE '%education%' OR LOWER(TRIM(business_type)) LIKE '%school%' OR LOWER(TRIM(business_type)) LIKE '%academy%' OR LOWER(TRIM(business_type)) LIKE '%preschool%' OR LOWER(TRIM(business_type)) LIKE '%learning%' OR LOWER(TRIM(business_type)) LIKE '%tutor%' OR LOWER(TRIM(business_type)) LIKE '%nursery%' THEN 'Childcare / Education'
  WHEN LOWER(TRIM(business_type)) LIKE '%entertainment%' OR LOWER(TRIM(business_type)) LIKE '%experiential%' OR LOWER(TRIM(business_type)) LIKE '%event%' OR LOWER(TRIM(business_type)) LIKE '%theater%' OR LOWER(TRIM(business_type)) LIKE '%cinema%' OR LOWER(TRIM(business_type)) LIKE '%gallery%' OR LOWER(TRIM(business_type)) LIKE '%museum%' OR LOWER(TRIM(business_type)) LIKE '%arcade%' OR LOWER(TRIM(business_type)) LIKE '%play%' OR LOWER(TRIM(business_type)) LIKE '%recreation%' OR LOWER(TRIM(business_type)) LIKE '%music%' THEN 'Entertainment / Experiential'
  WHEN LOWER(TRIM(business_type)) LIKE '%industrial%' OR LOWER(TRIM(business_type)) LIKE '%warehouse%' OR LOWER(TRIM(business_type)) LIKE '%logistics%' OR LOWER(TRIM(business_type)) LIKE '%distribution%' OR LOWER(TRIM(business_type)) LIKE '%storage%' OR LOWER(TRIM(business_type)) LIKE '%manufacturing%' OR LOWER(TRIM(business_type)) LIKE '%factory%' OR LOWER(TRIM(business_type)) LIKE '%auto%' OR LOWER(TRIM(business_type)) LIKE '%repair%' THEN 'Industrial / Warehouse'
  WHEN LOWER(TRIM(business_type)) LIKE '%hotel%' OR LOWER(TRIM(business_type)) LIKE '%hospitality%' OR LOWER(TRIM(business_type)) LIKE '%motel%' OR LOWER(TRIM(business_type)) LIKE '%hostel%' OR LOWER(TRIM(business_type)) LIKE '%inn%' OR LOWER(TRIM(business_type)) LIKE '%lodging%' THEN 'Hotel / Hospitality'
  
  -- Default fallback
  ELSE 'Other'
END
WHERE business_type IS NOT NULL;

UPDATE meta_leads
SET business_type = 'Other'
WHERE business_type IS NULL;

-- Enforce locations_count alignment
UPDATE tenant_requirements
SET location_count = 0
WHERE (operating_status = 'Concept / Planning' OR operating_status = 'Opening First Location') AND location_count <> 0;

UPDATE tenant_requirements
SET location_count = 1
WHERE (operating_status <> 'Concept / Planning' AND operating_status <> 'Opening First Location') AND (location_count IS NULL OR location_count = 0);
