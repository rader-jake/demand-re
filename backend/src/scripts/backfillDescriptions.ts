/**
 * backfillDescriptions.ts
 *
 * Repairs existing tenant_requirements records where ideal_space_description
 * is null/empty but the source meta_lead contains the value — either in the
 * parsed `ideal_space_description` column or inside `raw_payload` JSONB.
 *
 * Safe to run multiple times: only sets the field when currently null/empty.
 * Never overwrites a non-empty existing description.
 *
 * Usage:
 *   DATABASE_URL=... npm run backfill:descriptions
 */
import 'dotenv/config';
import { pool } from '../config/database';

// All known Facebook / CSV field name variants for the description question
const DESC_FIELD_KEYS = [
  'describe_your_ideal_space._(example:_bright_corner_storefront_in_williamsburg_for_a_pilates_concept_with_high_foot_traffic)',
  'describe_your_ideal_space',
  'ideal_space_description',
  'describe your ideal space',
];

function extractDescFromPayload(rawPayload: unknown): string | null {
  if (!rawPayload) return null;

  const payload: Record<string, string> =
    typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload as Record<string, string>;

  // 1. Exact / known key matches
  for (const key of DESC_FIELD_KEYS) {
    const val = payload[key] ?? payload[key.toLowerCase()];
    if (val?.trim()) return val.trim();
  }

  // 2. Partial key scan — any key containing "ideal_space" or "describe_your_ideal"
  const matchKey = Object.keys(payload).find(
    (k) =>
      k.toLowerCase().includes('ideal_space') ||
      k.toLowerCase().includes('describe_your_ideal')
  );
  if (matchKey && payload[matchKey]?.trim()) return payload[matchKey].trim();

  return null;
}

async function run() {
  console.log('=== Backfill: ideal_space_description ===\n');
  const client = await pool.connect();

  try {
    // Find requirements with missing descriptions
    // Look in both meta_leads (via join) and the requirement's own raw_payload
    const res = await client.query(`
      SELECT
        tr.id             AS req_id,
        tr.email          AS req_email,
        tr.full_name,
        tr.raw_payload    AS tr_raw_payload,
        ml.ideal_space_description AS ml_desc,
        ml.raw_payload    AS ml_raw_payload
      FROM tenant_requirements tr
      LEFT JOIN meta_leads ml ON (
        ml.meta_lead_id = tr.source_lead_id
        OR LOWER(ml.email) = LOWER(tr.email)
      )
      WHERE (tr.ideal_space_description IS NULL OR TRIM(tr.ideal_space_description) = '')
    `);

    console.log(`Found ${res.rows.length} requirement(s) with missing descriptions linked to Meta leads.`);

    let fixed = 0;
    let skipped = 0;

    for (const row of res.rows) {
      // Priority: meta_lead parsed field → meta_lead raw_payload → requirement's own raw_payload (CSV imports)
      const description =
        row.ml_desc?.trim() ||
        extractDescFromPayload(row.ml_raw_payload) ||
        extractDescFromPayload(row.tr_raw_payload);


      if (description) {
        await client.query(
          `UPDATE tenant_requirements
           SET ideal_space_description = $1, updated_at = NOW()
           WHERE id = $2
             AND (ideal_space_description IS NULL OR TRIM(ideal_space_description) = '')`,
          [description, row.req_id]
        );
        console.log(`  ✓ Fixed: ${row.full_name || row.req_email} — "${description.substring(0, 80)}${description.length > 80 ? '…' : ''}"`);
        fixed++;
      } else {
        console.log(`  – Skipped: ${row.full_name || row.req_email} — no description found in meta_lead or raw_payload`);
        skipped++;
      }
    }

    console.log(`\n--- Summary ---`);
    console.log(`  Fixed:   ${fixed}`);
    console.log(`  Skipped: ${skipped} (no description data available)`);
    console.log(`  Total:   ${res.rows.length}`);
    console.log('===============\n');

  } catch (err) {
    console.error('Backfill failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
