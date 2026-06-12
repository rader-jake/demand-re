import 'dotenv/config';
import { pool } from '../config/database';

async function run() {
  console.log('Creating landlord_waitlist table...');
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS landlord_waitlist (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name        VARCHAR(255) NOT NULL,
        company     VARCHAR(255) NOT NULL,
        email       VARCHAR(255) UNIQUE NOT NULL,
        role        VARCHAR(100) NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_landlord_waitlist_email ON landlord_waitlist(email);
    `);
    console.log('landlord_waitlist table created successfully.');
  } catch (error) {
    console.error('Failed to create landlord_waitlist table:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
