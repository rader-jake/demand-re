import 'dotenv/config';
import { pool } from '../config/database';
import { normalizeOperatingStatus } from '../utils/normalize';

async function run() {
  console.log('Running operating status normalization migration...');
  const client = await pool.connect();
  try {
    // Begin transaction
    await client.query('BEGIN');

    // 1. Normalize tenant_requirements
    const reqs = await client.query('SELECT id, operating_status, location_count FROM tenant_requirements');
    console.log(`Found ${reqs.rows.length} tenant requirements to check.`);
    
    let reqsUpdated = 0;
    for (const row of reqs.rows) {
      const originalStatus = row.operating_status;
      const normalizedStatus = normalizeOperatingStatus(originalStatus);
      
      let locationCount = row.location_count;
      const indicatesFirst = normalizedStatus === 'Concept / Planning' || normalizedStatus === 'Opening First Location';
      
      let locChanged = false;
      if (indicatesFirst && locationCount !== 0) {
        locationCount = 0;
        locChanged = true;
      } else if (!indicatesFirst && locationCount === 0) {
        locationCount = 1; // Default to 1 if it's currently operating but has 0 locations
        locChanged = true;
      }

      if (normalizedStatus !== originalStatus || locChanged) {
        await client.query(
          'UPDATE tenant_requirements SET operating_status = $1, location_count = $2, updated_at = NOW() WHERE id = $3',
          [normalizedStatus, locationCount, row.id]
        );
        reqsUpdated++;
      }
    }
    console.log(`Updated ${reqsUpdated} tenant requirements.`);

    // 2. Normalize meta_leads
    const leads = await client.query('SELECT id, currently_operating FROM meta_leads');
    console.log(`Found ${leads.rows.length} meta leads to check.`);
    
    let leadsUpdated = 0;
    for (const row of leads.rows) {
      const originalStatus = row.currently_operating;
      const normalizedStatus = normalizeOperatingStatus(originalStatus);

      if (normalizedStatus !== originalStatus) {
        await client.query(
          'UPDATE meta_leads SET currently_operating = $1, updated_at = NOW() WHERE id = $2',
          [normalizedStatus, row.id]
        );
        leadsUpdated++;
      }
    }
    console.log(`Updated ${leadsUpdated} meta leads.`);

    await client.query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
