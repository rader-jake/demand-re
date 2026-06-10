import 'dotenv/config';
import { pool } from '../config/database';

async function run() {
  console.log('Running migration for meta_leads table...');
  const client = await pool.connect();
  try {
    // 1. Create table
    await client.query(`
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
    `);
    console.log('Table meta_leads checked/created successfully.');

    // 2. Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_meta_leads_email_lower ON meta_leads(LOWER(email));
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_meta_leads_user_id ON meta_leads(user_id);
    `);
    console.log('Indexes checked/created successfully.');

    // 3. Create trigger
    // Since CREATE TRIGGER does not have IF NOT EXISTS in all Postgres versions, we drop it first and recreate it,
    // or wrap in a check. Dropping and recreating is safe.
    await client.query(`
      DROP TRIGGER IF EXISTS trg_meta_leads_updated_at ON meta_leads;
      CREATE TRIGGER trg_meta_leads_updated_at
        BEFORE UPDATE ON meta_leads
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `);
    console.log('Trigger trg_meta_leads_updated_at checked/created successfully.');

    console.log('Migration for meta_leads completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
