import 'dotenv/config';
import { pool } from '../config/database';

async function run() {
  console.log('Running migration for tenant_requirements and account_activations...');
  const client = await pool.connect();
  try {
    // 1. Create tenant_requirements table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenant_requirements (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        source TEXT,
        source_lead_id TEXT,
        full_name TEXT,
        email TEXT,
        phone TEXT,
        business_type TEXT,
        operating_status TEXT,
        location_count INTEGER DEFAULT 1,
        boroughs JSONB,
        neighborhoods JSONB,
        location_flexibility TEXT,
        space_types JSONB,
        min_square_feet INTEGER,
        max_square_feet INTEGER,
        ideal_square_feet INTEGER,
        min_monthly_budget INTEGER,
        max_monthly_budget INTEGER,
        budget_flexibility TEXT,
        move_timeline_label TEXT,
        target_move_start_date DATE,
        target_move_end_date DATE,
        urgency_status TEXT,
        ideal_space_description TEXT,
        contact_permission BOOLEAN,
        status TEXT,
        freshness_status TEXT,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Table tenant_requirements created/checked.');

    // Create trigger for updated_at on tenant_requirements
    await client.query(`
      DROP TRIGGER IF EXISTS trg_tenant_requirements_updated_at ON tenant_requirements;
      CREATE TRIGGER trg_tenant_requirements_updated_at
        BEFORE UPDATE ON tenant_requirements
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tenant_requirements_email ON tenant_requirements(email);
      CREATE INDEX IF NOT EXISTS idx_tenant_requirements_user_id ON tenant_requirements(user_id);
    `);

    // 2. Create account_activations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS account_activations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email TEXT UNIQUE NOT NULL,
        token TEXT NOT NULL,
        is_completed BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
      );
    `);
    console.log('Table account_activations created/checked.');

    // 3. Alter tenant_matches to add requirement_id
    await client.query(`
      ALTER TABLE tenant_matches ADD COLUMN IF NOT EXISTS requirement_id UUID REFERENCES tenant_requirements(id) ON DELETE CASCADE;
      ALTER TABLE tenant_matches ALTER COLUMN lead_id DROP NOT NULL;
    `);
    console.log('Columns added/altered on tenant_matches.');

    // Create index on tenant_matches(requirement_id)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tenant_matches_requirement_id ON tenant_matches(requirement_id);
    `);

    // 4. Migrate existing meta_leads to tenant_requirements
    const metaLeadsResult = await client.query('SELECT * FROM meta_leads');
    console.log(`Migrating ${metaLeadsResult.rows.length} existing leads...`);

    for (const lead of metaLeadsResult.rows as any[]) {
      // Avoid inserting duplicates if we rerun
      const existingReq = await client.query('SELECT id FROM tenant_requirements WHERE source_lead_id = $1', [lead.meta_lead_id]);
      if (existingReq.rows.length > 0) {
        // Link matches to the existing requirement if not done
        const reqId = existingReq.rows[0].id;
        await client.query(`
          UPDATE tenant_matches SET requirement_id = $1 WHERE lead_id = $2 AND requirement_id IS NULL
        `, [reqId, lead.id]);
        continue;
      }

      // Parse desired_location into boroughs/neighborhoods
      const desiredLoc = lead.desired_location || '';
      const boroughs: string[] = [];
      const lowerLoc = desiredLoc.toLowerCase();
      if (lowerLoc.includes('brooklyn')) boroughs.push('Brooklyn');
      if (lowerLoc.includes('manhattan')) boroughs.push('Manhattan');
      if (lowerLoc.includes('queens')) boroughs.push('Queens');
      if (lowerLoc.includes('bronx')) boroughs.push('Bronx');
      if (lowerLoc.includes('staten')) boroughs.push('Staten Island');
      
      const neighborhoods = desiredLoc ? [desiredLoc] : [];

      // Parse space size
      let minSqft = null;
      let maxSqft = null;
      if (lead.space_size) {
        const numbers = lead.space_size.replace(/,/g, '').match(/\d+/g);
        if (numbers && numbers.length > 0) {
          if (numbers.length === 1) {
            const val = parseInt(numbers[0], 10);
            minSqft = Math.round(val * 0.9);
            maxSqft = Math.round(val * 1.1);
          } else {
            minSqft = parseInt(numbers[0], 10);
            maxSqft = parseInt(numbers[1], 10);
          }
        }
      }

      // Parse budget
      let minBudget = null;
      let maxBudget = null;
      if (lead.monthly_budget) {
        const numbers = lead.monthly_budget.replace(/,/g, '').match(/\d+/g);
        if (numbers && numbers.length > 0) {
          if (numbers.length === 1) {
            const val = parseInt(numbers[0], 10);
            minBudget = Math.round(val * 0.9);
            maxBudget = Math.round(val * 1.1);
          } else {
            minBudget = parseInt(numbers[0], 10);
            maxBudget = parseInt(numbers[1], 10);
          }
        }
      }

      // Map move timeline to start/end dates
      let startMove = null;
      let endMove = null;
      let urgency = 'medium';
      if (lead.move_timeline) {
        const lowerTimeline = lead.move_timeline.toLowerCase();
        if (lowerTimeline.includes('3 months') || lowerTimeline.includes('now') || lowerTimeline.includes('asap') || lowerTimeline.includes('immediate')) {
          urgency = 'high';
          startMove = new Date();
          endMove = new Date();
          endMove.setMonth(endMove.getMonth() + 3);
        } else if (lowerTimeline.includes('6 months')) {
          startMove = new Date();
          startMove.setMonth(startMove.getMonth() + 3);
          endMove = new Date();
          endMove.setMonth(endMove.getMonth() + 6);
        } else {
          startMove = new Date();
          endMove = new Date();
          endMove.setMonth(endMove.getMonth() + 12);
        }
      }

      // Map status
      let status = 'New';
      if (lead.lead_status === 'matches_sent') {
        status = 'Matches Sent';
      } else if (lead.lead_status === 'linked' || lead.lead_status === 'processed') {
        status = 'Reviewing';
      }

      // Freshness
      const daysDiff = (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24);
      let freshness = 'Fresh';
      if (daysDiff > 180) freshness = 'Stale';
      else if (daysDiff > 90) freshness = 'Aging';
      else if (daysDiff > 30) freshness = 'Warm';

      // Insert requirement
      const reqResult = await client.query(`
        INSERT INTO tenant_requirements (
          source, source_lead_id, full_name, email, phone, business_type,
          operating_status, location_count, boroughs, neighborhoods, location_flexibility,
          space_types, min_square_feet, max_square_feet, ideal_square_feet,
          min_monthly_budget, max_monthly_budget, budget_flexibility,
          move_timeline_label, target_move_start_date, target_move_end_date,
          urgency_status, ideal_space_description, contact_permission,
          status, freshness_status, user_id, created_at, updated_at, last_confirmed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
        RETURNING id
      `, [
        'meta', lead.meta_lead_id, lead.full_name, lead.email.toLowerCase().trim(), lead.phone_number, lead.business_type,
        lead.currently_operating, 1, JSON.stringify(boroughs), JSON.stringify(neighborhoods), 'flexible',
        JSON.stringify(lead.space_type ? [lead.space_type] : []), minSqft, maxSqft, maxSqft,
        minBudget, maxBudget, 'flexible',
        lead.move_timeline, startMove, endMove,
        urgency, lead.ideal_space_description, lead.wants_contact,
        status, freshness, lead.user_id, lead.created_at, lead.updated_at, lead.created_at
      ]);

      const requirementId = reqResult.rows[0].id;

      // Update tenant_matches that point to this lead
      await client.query(`
        UPDATE tenant_matches SET requirement_id = $1 WHERE lead_id = $2
      `, [requirementId, lead.id]);
    }

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  } finally {
    client.release();
  }
}

run().then(() => pool.end());
