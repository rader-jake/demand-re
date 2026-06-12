import 'dotenv/config';
import { pool } from '../config/database';

const REQUIRED_TABLES = [
  'users',
  'tenant_requirements',
  'meta_leads',
  'account_activations',
  'tenant_matches'
];

const REQUIRED_COLUMNS_REQUIREMENTS = [
  'id',
  'user_id',
  'source',
  'source_lead_id',
  'full_name',
  'email',
  'phone',
  'business_type',
  'concept_description',
  'other_business_type',
  'operating_status',
  'location_count',
  'boroughs',
  'neighborhoods',
  'location_flexibility',
  'space_types',
  'min_square_feet',
  'max_square_feet',
  'ideal_square_feet',
  'square_feet_range_label',
  'min_monthly_budget',
  'max_monthly_budget',
  'budget_range_label',
  'budget_flexibility',
  'move_timeline_label',
  'target_move_start_date',
  'target_move_end_date',
  'urgency_status',
  'ideal_space_description',
  'contact_permission',
  'status',
  'freshness_status',
  'last_confirmed_at',
  'created_at',
  'updated_at'
];

async function check() {
  console.log('Running database schema integrity check...');
  const client = await pool.connect();
  let errors = 0;

  try {
    // 1. Check Tables
    const tablesRes = await client.query<{ table_name: string }>(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = ANY($1)
    `, [REQUIRED_TABLES]);

    const existingTables = new Set(tablesRes.rows.map(r => r.table_name));
    for (const table of REQUIRED_TABLES) {
      if (!existingTables.has(table)) {
        console.error(`[-] MISSING TABLE: Table '${table}' does not exist.`);
        errors++;
      } else {
        console.log(`[+] OK: Table '${table}' exists.`);
      }
    }

    // 2. Check Columns in tenant_requirements
    if (existingTables.has('tenant_requirements')) {
      const columnsRes = await client.query<{ column_name: string }>(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'tenant_requirements' AND column_name = ANY($1)
      `, [REQUIRED_COLUMNS_REQUIREMENTS]);

      const existingColumns = new Set(columnsRes.rows.map(r => r.column_name));
      for (const column of REQUIRED_COLUMNS_REQUIREMENTS) {
        if (!existingColumns.has(column)) {
          console.error(`[-] MISSING COLUMN: Column '${column}' does not exist on table 'tenant_requirements'.`);
          errors++;
        } else {
          console.log(`[+] OK: Column 'tenant_requirements.${column}' exists.`);
        }
      }
    }

    if (errors > 0) {
      console.error(`\nSchema check failed with ${errors} error(s). Please run 'npm run db:migrate' to sync schema.`);
      process.exit(1);
    } else {
      console.log('\n[+] Schema check completed successfully! All tables and columns are present.');
      process.exit(0);
    }
  } catch (error) {
    console.error('Schema check execution failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

check();
