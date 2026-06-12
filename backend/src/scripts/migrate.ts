import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';

async function run() {
  console.log('Starting production database schema sync migration...');
  
  const migrationPath = path.join(__dirname, '../../migrations/20260612_sync_production_schema.sql');
  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration file not found at: ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  const client = await pool.connect();
  
  try {
    console.log('Acquired database connection pool client.');
    await client.query('BEGIN');
    console.log('Executing migration SQL commands...');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration completed successfully and committed to database.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed, transaction rolled back:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
