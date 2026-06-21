import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';

async function run() {
  console.log('Starting production database schema sync migration...');
  
  const migrationsDir = path.join(__dirname, '../../migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.error(`Migrations directory not found at: ${migrationsDir}`);
    process.exit(1);
  }

  // Get all .sql files in alphabetical order
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migration files found.');
    process.exit(0);
  }

  const client = await pool.connect();
  
  try {
    console.log('Acquired database connection pool client.');
    for (const file of files) {
      console.log(`Running migration: ${file}...`);
      const migrationPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(migrationPath, 'utf8');
      
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log(`Completed migration: ${file}`);
    }
    console.log('All migrations completed successfully.');
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
