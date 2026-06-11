import 'dotenv/config';
import { pool } from '../config/database';

async function run() {
  console.log('Altering tenant_requirements to add range labels...');
  const client = await pool.connect();
  try {
    // Add budget_range_label
    await client.query(`
      ALTER TABLE tenant_requirements
      ADD COLUMN IF NOT EXISTS budget_range_label TEXT;
    `);
    console.log('Column budget_range_label checked/created.');

    // Add square_feet_range_label
    await client.query(`
      ALTER TABLE tenant_requirements
      ADD COLUMN IF NOT EXISTS square_feet_range_label TEXT;
    `);
    console.log('Column square_feet_range_label checked/created.');

    console.log('Database migration for range label columns completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
