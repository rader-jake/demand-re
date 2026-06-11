import 'dotenv/config';
import { pool } from '../config/database';

async function run() {
  const client = await pool.connect();
  try {
    console.log('Running foreign keys and view migration...');

    // 1. Copy existing profiles and space requirements into tenant_requirements with same IDs
    console.log('Copying existing profiles to tenant_requirements...');
    await client.query(`
      INSERT INTO tenant_requirements (
        id, user_id, source, full_name, email, business_type, operating_status,
        location_count, boroughs, neighborhoods, location_flexibility, space_types,
        min_square_feet, max_square_feet, ideal_square_feet,
        min_monthly_budget, max_monthly_budget, budget_flexibility,
        move_timeline_label, target_move_start_date, target_move_end_date,
        urgency_status, ideal_space_description, contact_permission,
        status, freshness_status, created_at, updated_at
      )
      SELECT
        tp.id,
        tp.user_id,
        'web',
        tp.legal_name,
        u.email,
        tp.industry,
        'Operating',
        tp.number_of_locations,
        '[]'::jsonb,
        coalesce(to_jsonb(tsr.preferred_neighborhoods), '[]'::jsonb),
        CASE WHEN tsr.flexible_on_location THEN 'flexible' ELSE 'strict' END,
        jsonb_build_array(tp.space_use_type::text),
        tsr.sqft_min,
        tsr.sqft_max,
        tsr.sqft_max,
        tsr.budget_monthly_min::integer,
        tsr.budget_monthly_max::integer,
        'flexible',
        tsr.timeline_notes,
        tsr.target_move_in_date,
        tsr.target_move_in_date,
        'medium',
        tp.description,
        TRUE,
        CASE WHEN tp.status = 'active' THEN 'Reviewing' ELSE 'New' END,
        'Fresh',
        tp.created_at,
        tp.updated_at
      FROM tenant_profiles tp
      JOIN users u ON u.id = tp.user_id
      LEFT JOIN tenant_space_requirements tsr ON tsr.tenant_profile_id = tp.id
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log('Existing profiles copied successfully.');

    // 2. Drop constraints first
    await client.query(`
      ALTER TABLE interest_expressions DROP CONSTRAINT IF EXISTS interest_expressions_tenant_profile_id_fkey;
      ALTER TABLE saved_tenants DROP CONSTRAINT IF EXISTS saved_tenants_tenant_profile_id_fkey;
      ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_tenant_profile_id_fkey;
      ALTER TABLE tenant_scores DROP CONSTRAINT IF EXISTS tenant_scores_tenant_profile_id_fkey;
    `);

    // 3. Add new foreign key constraints referencing tenant_requirements
    await client.query(`
      ALTER TABLE interest_expressions ADD CONSTRAINT interest_expressions_tenant_profile_id_fkey FOREIGN KEY (tenant_profile_id) REFERENCES tenant_requirements(id) ON DELETE CASCADE;
      ALTER TABLE saved_tenants ADD CONSTRAINT saved_tenants_tenant_profile_id_fkey FOREIGN KEY (tenant_profile_id) REFERENCES tenant_requirements(id) ON DELETE CASCADE;
      ALTER TABLE deals ADD CONSTRAINT deals_tenant_profile_id_fkey FOREIGN KEY (tenant_profile_id) REFERENCES tenant_requirements(id) ON DELETE CASCADE;
      ALTER TABLE tenant_scores ADD CONSTRAINT tenant_scores_tenant_profile_id_fkey FOREIGN KEY (tenant_profile_id) REFERENCES tenant_requirements(id) ON DELETE CASCADE;
    `);
    console.log('Foreign key constraints updated to reference tenant_requirements.');

    // 4. Redefine tenant_search_view
    await client.query(`
      DROP VIEW IF EXISTS tenant_search_view;
      CREATE VIEW tenant_search_view AS
      SELECT
        tr.id AS profile_id,
        tr.user_id,
        tr.status,
        tr.full_name AS legal_name,
        tr.full_name AS dba_name,
        tr.business_type AS industry,
        NULL::text AS sub_industry,
        COALESCE(tr.space_types->>0, 'office') AS space_use_type,
        NULL::integer AS years_in_operation,
        tr.location_count AS number_of_locations,
        NULL::text AS website,
        tr.ideal_space_description AS description,
        NULL::text AS ownership_structure,
        NULL::text AS revenue_range,
        NULL::text AS credit_score_range,
        NULL::text AS funding_status,
        NULL::boolean AS has_guarantor,
        FALSE AS revenue_visible,
        FALSE AS credit_visible,
        FALSE AS financials_unlockable,
        100 AS profile_completeness,
        0 AS view_count,
        0 AS interest_count,
        -- Space requirements
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(tr.neighborhoods, '[]'::jsonb)))::text[] AS preferred_neighborhoods,
        tr.min_square_feet AS sqft_min,
        tr.max_square_feet AS sqft_max,
        NULL::numeric AS budget_psf_min,
        NULL::numeric AS budget_psf_max,
        tr.min_monthly_budget::numeric AS budget_monthly_min,
        tr.max_monthly_budget::numeric AS budget_monthly_max,
        'flexible'::lease_term_pref AS lease_term_preference,
        tr.target_move_start_date AS target_move_in_date,
        FALSE AS requires_venting,
        FALSE AS requires_frontage,
        FALSE AS requires_elevator,
        FALSE AS requires_parking,
        -- Scores
        COALESCE(ts.financial_strength_score, 75) AS financial_strength_score,
        COALESCE(ts.expansion_likelihood_score, 75) AS expansion_likelihood_score,
        COALESCE(ts.market_desirability_score, 75) AS market_desirability_score,
        COALESCE(ts.desirability_index, 75.0)::numeric AS desirability_index,
        -- User info
        u.first_name,
        u.last_name,
        u.avatar_url,
        tr.created_at,
        tr.updated_at
      FROM tenant_requirements tr
      LEFT JOIN users u ON u.id = tr.user_id
      LEFT JOIN tenant_scores ts ON ts.tenant_profile_id = tr.id
      WHERE tr.status != 'Closed Lost' AND tr.status != 'Dormant' AND (tr.user_id IS NULL OR u.is_active = TRUE);
    `);

    console.log('Migration of foreign keys and search view completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

run().then(() => pool.end());
