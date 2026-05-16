-- ============================================================
-- CRE Marketplace - Seed Data
-- ============================================================
-- Passwords are all: "Password123!" (bcrypt hash below)
-- Hash: $2b$10$YourHashHere (replace with real hash on first run)

-- Admin user
INSERT INTO users (id, email, password_hash, role, first_name, last_name, is_verified)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin@cremarketplace.com',
   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- Password123!
   'admin', 'Platform', 'Admin', TRUE),

  ('00000000-0000-0000-0000-000000000002', 'landlord@example.com',
   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
   'landlord', 'Sarah', 'Chen', TRUE),

  ('00000000-0000-0000-0000-000000000003', 'landlord2@example.com',
   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
   'landlord', 'Marcus', 'Williams', TRUE),

  ('00000000-0000-0000-0000-000000000010', 'tenant1@example.com',
   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
   'tenant', 'Alex', 'Rivera', TRUE),

  ('00000000-0000-0000-0000-000000000011', 'tenant2@example.com',
   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
   'tenant', 'Jordan', 'Park', TRUE),

  ('00000000-0000-0000-0000-000000000012', 'tenant3@example.com',
   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
   'tenant', 'Taylor', 'Smith', TRUE);

-- Landlord profiles
INSERT INTO landlord_profiles (user_id, company_name, company_type, bio, boroughs)
VALUES
  ('00000000-0000-0000-0000-000000000002',
   'Chen Properties LLC', 'owner',
   'NYC commercial real estate owner with 15 years experience. Specializing in retail and F&B in Manhattan.',
   ARRAY['Manhattan', 'Brooklyn']),

  ('00000000-0000-0000-0000-000000000003',
   'Williams Realty Group', 'broker',
   'Licensed commercial broker representing landlords across all 5 boroughs.',
   ARRAY['Manhattan', 'Queens', 'Brooklyn', 'Bronx']);

-- Tenant profiles
INSERT INTO tenant_profiles (id, user_id, status, legal_name, dba_name, industry, sub_industry,
  years_in_operation, number_of_locations, website, description,
  ownership_structure, space_use_type, revenue_range, credit_score_range,
  funding_status, has_guarantor, revenue_visible, credit_visible,
  financials_unlockable, profile_completeness)
VALUES
  ('10000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000010',
   'active', 'Rivera Coffee Co. LLC', 'Brew & Bloom', 'Food & Beverage', 'Specialty Coffee',
   4, 2, 'https://brewandbloom.com',
   'Fast-growing specialty coffee brand with two locations in Brooklyn. Known for our single-origin roasts and community-focused spaces. Looking to expand into Manhattan.',
   'llc', 'retail', '1m_5m', '700_749', 'angel', TRUE, FALSE, FALSE, TRUE, 92),

  ('10000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000011',
   'active', 'Park Design Studio Inc.', 'Studio Park', 'Creative & Design', 'Interior Design',
   7, 1, 'https://studiopark.nyc',
   'Award-winning interior design firm seeking a larger studio and client-facing showroom space. Strong client roster including Fortune 500 companies.',
   'corporation', 'office', '1m_5m', '750_799', 'bootstrapped', FALSE, FALSE, TRUE, TRUE, 88),

  ('10000000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000012',
   'active', 'FitWave Holdings LLC', 'FitWave', 'Health & Fitness', 'Boutique Fitness',
   2, 3, 'https://fitwave.com',
   'VC-backed boutique fitness concept expanding aggressively across NYC. Currently 3 locations, targeting 8 by end of year.',
   'llc', 'retail', '1m_5m', '650_699', 'series_a', TRUE, FALSE, FALSE, TRUE, 85);

-- Space requirements
INSERT INTO tenant_space_requirements (tenant_profile_id, preferred_neighborhoods,
  sqft_min, sqft_max, budget_psf_min, budget_psf_max, lease_term_preference,
  lease_term_years_min, lease_term_years_max, target_move_in_date,
  requires_venting, requires_frontage, requires_elevator)
VALUES
  ('10000000-0000-0000-0000-000000000001',
   ARRAY['SoHo', 'Nolita', 'Lower East Side', 'West Village'],
   800, 1500, 80, 130, 'medium_term', 5, 10, '2025-04-01',
   TRUE, TRUE, FALSE),

  ('10000000-0000-0000-0000-000000000002',
   ARRAY['Chelsea', 'Flatiron', 'Midtown South', 'SoHo'],
   2000, 4000, 60, 90, 'long_term', 5, 10, '2025-06-01',
   FALSE, FALSE, TRUE),

  ('10000000-0000-0000-0000-000000000003',
   ARRAY['Upper West Side', 'Upper East Side', 'Midtown', 'Chelsea', 'Flatiron'],
   2500, 5000, 70, 120, 'long_term', 7, 15, '2025-03-01',
   FALSE, TRUE, TRUE);

-- Tenant scores (computed)
INSERT INTO tenant_scores (tenant_profile_id, financial_strength_score, expansion_likelihood_score,
  operational_stability_score, market_desirability_score, desirability_index, score_factors)
VALUES
  ('10000000-0000-0000-0000-000000000001', 74, 82, 78, 88, 80.5,
   '{"financial":{"revenue_score":70,"credit_score":76,"funding_score":72},"expansion":{"locations_growth":85,"funding_stage":78},"stability":{"years_ops":72,"ownership":82},"market":{"industry_demand":90,"neighborhood_fit":86}}'::jsonb),

  ('10000000-0000-0000-0000-000000000002', 82, 60, 90, 75, 76.75,
   '{"financial":{"revenue_score":78,"credit_score":85,"funding_score":80},"expansion":{"locations_growth":55,"funding_stage":60},"stability":{"years_ops":90,"ownership":88},"market":{"industry_demand":72,"neighborhood_fit":78}}'::jsonb),

  ('10000000-0000-0000-0000-000000000003', 68, 95, 55, 82, 75.0,
   '{"financial":{"revenue_score":65,"credit_score":68,"funding_score":85},"expansion":{"locations_growth":98,"funding_stage":92},"stability":{"years_ops":45,"ownership":70},"market":{"industry_demand":85,"neighborhood_fit":80}}'::jsonb);

-- Sample user events for analytics
INSERT INTO user_events (user_id, event_type, entity_type, entity_id, properties)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'search', 'tenant_search', NULL,
   '{"filters":{"industry":"Food & Beverage","neighborhood":"SoHo"},"result_count":3}'::jsonb),
  ('00000000-0000-0000-0000-000000000002', 'profile_view', 'tenant_profile',
   '10000000-0000-0000-0000-000000000001', '{"source":"search"}'::jsonb),
  ('00000000-0000-0000-0000-000000000003', 'search', 'tenant_search', NULL,
   '{"filters":{"industry":"Health & Fitness","neighborhood":"Chelsea"},"result_count":2}'::jsonb);

-- Sample demand heatmap data
INSERT INTO demand_heatmap (neighborhood, borough, period_start, period_end, space_use_type,
  industry, search_count, active_tenants, avg_budget_psf, avg_sqft_need)
VALUES
  ('SoHo', 'Manhattan', '2025-01-01', '2025-01-31', 'retail', 'Food & Beverage', 47, 12, 105.00, 1200),
  ('SoHo', 'Manhattan', '2025-01-01', '2025-01-31', 'retail', 'Fashion & Apparel', 38, 9, 120.00, 1800),
  ('Chelsea', 'Manhattan', '2025-01-01', '2025-01-31', 'office', 'Creative & Design', 29, 7, 72.00, 3000),
  ('Chelsea', 'Manhattan', '2025-01-01', '2025-01-31', 'retail', 'Health & Fitness', 33, 8, 95.00, 3500),
  ('Flatiron', 'Manhattan', '2025-01-01', '2025-01-31', 'office', 'Technology', 52, 15, 80.00, 4500),
  ('Upper West Side', 'Manhattan', '2025-01-01', '2025-01-31', 'retail', 'Health & Fitness', 28, 6, 88.00, 2800),
  ('Williamsburg', 'Brooklyn', '2025-01-01', '2025-01-31', 'retail', 'Food & Beverage', 41, 11, 78.00, 1100),
  ('DUMBO', 'Brooklyn', '2025-01-01', '2025-01-31', 'office', 'Technology', 35, 9, 65.00, 3800);
