import 'dotenv/config';
import { pool } from '../config/database';

async function run() {
  console.log('Running migration for tenant_matches table...');
  const client = await pool.connect();
  try {
    // 1. Create table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenant_matches (
        id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        lead_id             UUID NOT NULL REFERENCES meta_leads(id) ON DELETE CASCADE,
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
        tenant_sent         BOOLEAN DEFAULT false,
        created_at          TIMESTAMPTZ DEFAULT NOW(),
        updated_at          TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('Table tenant_matches checked/created successfully.');

    // 2. Create index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tenant_matches_lead_id ON tenant_matches(lead_id);
    `);
    console.log('Index idx_tenant_matches_lead_id checked/created successfully.');

    // 3. Create trigger
    await client.query(`
      DROP TRIGGER IF EXISTS trg_tenant_matches_updated_at ON tenant_matches;
      CREATE TRIGGER trg_tenant_matches_updated_at
        BEFORE UPDATE ON tenant_matches
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `);
    console.log('Trigger trg_tenant_matches_updated_at checked/created successfully.');

    console.log('Migration for tenant_matches completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
