import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database';
import { ScoringService } from '../services/scoring';
import { normalizeBusinessType, normalizeOperatingStatus } from '../utils/normalize';

function mapSpaceUseType(val: string | null): string {
  if (!val) return 'office';
  const lower = val.toLowerCase().trim();
  if (lower.includes('retail') || lower.includes('shop') || lower.includes('store')) return 'retail';
  if (lower.includes('office') || lower.includes('corporate') || lower.includes('hq')) return 'office';
  if (lower.includes('industrial') || lower.includes('warehouse') || lower.includes('factory')) return 'industrial';
  if (lower.includes('flex')) return 'flex';
  if (lower.includes('medical') || lower.includes('clinic') || lower.includes('doctor') || lower.includes('hospital')) return 'medical';
  if (lower.includes('restaurant') || lower.includes('food') || lower.includes('cafe') || lower.includes('bar')) return 'restaurant';
  if (lower.includes('mixed')) return 'mixed';
  return 'office';
}

function parseSqft(val: string | null): { min: number | null; max: number | null } {
  if (!val) return { min: null, max: null };
  const numbers = val.replace(/,/g, '').match(/\d+/g);
  if (!numbers || numbers.length === 0) return { min: null, max: null };
  if (numbers.length === 1) {
    const size = parseInt(numbers[0], 10);
    return { min: Math.round(size * 0.9), max: Math.round(size * 1.1) };
  }
  return { min: parseInt(numbers[0], 10), max: parseInt(numbers[1], 10) };
}

function parseBudget(val: string | null): { min: number | null; max: number | null } {
  if (!val) return { min: null, max: null };
  const numbers = val.replace(/,/g, '').match(/\d+/g);
  if (!numbers || numbers.length === 0) return { min: null, max: null };
  if (numbers.length === 1) {
    const budget = parseInt(numbers[0], 10);
    return { min: Math.round(budget * 0.9), max: Math.round(budget * 1.1) };
  }
  return { min: parseInt(numbers[0], 10), max: parseInt(numbers[1], 10) };
}

async function run() {
  console.log('Starting backfill of tenant requirements from Meta Leads...');
  const client = await pool.connect();

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let linked = 0;
  let tokensGenerated = 0;

  try {
    const leadsRes = await client.query('SELECT * FROM meta_leads');
    console.log(`Found ${leadsRes.rows.length} Meta leads in the database.`);

    for (const lead of leadsRes.rows) {
      const email = lead.email.trim().toLowerCase();
      const metaLeadId = lead.meta_lead_id;
      const leadId = lead.id;

      // 1. Find user with same email (optional linking)
      const userRes = await client.query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
      const userId = userRes.rows.length > 0 ? userRes.rows[0].id : (lead.user_id || null);

      // Parse metadata fields
      const boroughs: string[] = [];
      if (lead.desired_location) {
        const lowerLoc = lead.desired_location.toLowerCase();
        if (lowerLoc.includes('brooklyn')) boroughs.push('Brooklyn');
        if (lowerLoc.includes('manhattan')) boroughs.push('Manhattan');
        if (lowerLoc.includes('queens')) boroughs.push('Queens');
        if (lowerLoc.includes('bronx')) boroughs.push('Bronx');
        if (lowerLoc.includes('staten')) boroughs.push('Staten Island');
      }
      const neighborhoods = lead.desired_location ? [lead.desired_location] : [];

      const { min: minSqft, max: maxSqft } = parseSqft(lead.space_size);
      const idealSqft = maxSqft;

      const { min: minBud, max: maxBud } = parseBudget(lead.monthly_budget);

      let startMove: Date | null = lead.created_time ? new Date(lead.created_time) : new Date();
      let endMove: Date | null = lead.created_time ? new Date(lead.created_time) : new Date();
      let urgency = 'medium';
      if (lead.move_timeline) {
        const lowerTimeline = lead.move_timeline.toLowerCase();
        if (lowerTimeline.includes('3 months') || lowerTimeline.includes('now') || lowerTimeline.includes('asap') || lowerTimeline.includes('immediate')) {
          urgency = 'high';
          endMove.setMonth(endMove.getMonth() + 3);
        } else if (lowerTimeline.includes('6 months')) {
          startMove.setMonth(startMove.getMonth() + 3);
          endMove.setMonth(endMove.getMonth() + 6);
        } else {
          endMove.setMonth(endMove.getMonth() + 12);
        }
      } else {
        startMove = null;
        endMove = null;
      }

      const freshness = 'Fresh';
      const mappedSpaceType = lead.space_type ? mapSpaceUseType(lead.space_type) : 'office';
      const spaceTypesJson = JSON.stringify([mappedSpaceType]);
      const status = 'New';

      const normBusinessType = normalizeBusinessType(lead.business_type);
      const normOperatingStatus = normalizeOperatingStatus(lead.currently_operating);

      // Check if requirement already exists for this lead or email
      const checkReq = await client.query(
        `SELECT id, user_id FROM tenant_requirements 
         WHERE source_lead_id = $1 OR source_lead_id = $2 OR LOWER(email) = LOWER($3)`,
        [metaLeadId, leadId, email]
      );

      let requirementId: string;
      if (checkReq.rows.length > 0) {
        requirementId = checkReq.rows[0].id;

        // Update existing requirement
        await client.query(`
          UPDATE tenant_requirements SET
            full_name = COALESCE($1, full_name),
            phone = COALESCE($2, phone),
            business_type = COALESCE($3, business_type),
            operating_status = COALESCE($4, operating_status),
            boroughs = $5,
            neighborhoods = $6,
            space_types = $7,
            min_square_feet = COALESCE($8, min_square_feet),
            max_square_feet = COALESCE($9, max_square_feet),
            ideal_square_feet = COALESCE($10, ideal_square_feet),
            min_monthly_budget = COALESCE($11, min_monthly_budget),
            max_monthly_budget = COALESCE($12, max_monthly_budget),
            move_timeline_label = COALESCE($13, move_timeline_label),
            target_move_start_date = COALESCE($14, target_move_start_date),
            target_move_end_date = COALESCE($15, target_move_end_date),
            urgency_status = COALESCE($16, urgency_status),
            ideal_space_description = COALESCE($17, ideal_space_description),
            contact_permission = COALESCE($18, contact_permission),
            user_id = COALESCE(user_id, $19),
            updated_at = NOW()
          WHERE id = $20
        `, [
          lead.full_name, lead.phone_number, normBusinessType, normOperatingStatus,
          JSON.stringify(boroughs), JSON.stringify(neighborhoods), spaceTypesJson,
          minSqft, maxSqft, idealSqft,
          minBud, maxBud,
          lead.move_timeline, startMove, endMove,
          urgency, lead.ideal_space_description, lead.wants_contact,
          userId, requirementId
        ]);

        if (userId && !lead.user_id) {
          await client.query(
            "UPDATE meta_leads SET user_id = $1, lead_status = 'linked' WHERE id = $2",
            [userId, leadId]
          );
          linked++;
        }

        updated++;
      } else {
        // Create new requirement
        const insertRes = await client.query<{ id: string }>(`
          INSERT INTO tenant_requirements (
            source, source_lead_id, full_name, email, phone, business_type, operating_status,
            boroughs, neighborhoods, location_flexibility, space_types,
            min_square_feet, max_square_feet, ideal_square_feet,
            min_monthly_budget, max_monthly_budget, budget_flexibility,
            move_timeline_label, target_move_start_date, target_move_end_date,
            urgency_status, ideal_space_description, contact_permission,
            status, freshness_status, user_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
          RETURNING id
        `, [
          'meta_lead', metaLeadId, lead.full_name, email, lead.phone_number, normBusinessType, normOperatingStatus,
          JSON.stringify(boroughs), JSON.stringify(neighborhoods), 'flexible', spaceTypesJson,
          minSqft, maxSqft, idealSqft,
          minBud, maxBud, 'flexible',
          lead.move_timeline, startMove, endMove,
          urgency, lead.ideal_space_description, lead.wants_contact,
          status, freshness, userId
        ]);
        
        requirementId = insertRes.rows[0].id;
        created++;

        if (userId) {
          await client.query(
            "UPDATE meta_leads SET user_id = $1, lead_status = 'linked' WHERE id = $2",
            [userId, leadId]
          );
          linked++;
        }
      }

      // Generate secure activation token if there is no activated user
      if (!userId) {
        const tokenCheck = await client.query(
          `SELECT token FROM account_activations
           WHERE LOWER(email) = $1 AND is_completed = FALSE AND expires_at > NOW()`,
          [email]
        );
        
        if (tokenCheck.rows.length === 0) {
          const activationToken = uuidv4();
          await client.query(`
            INSERT INTO account_activations (email, token, is_completed, created_at, expires_at)
            VALUES ($1, $2, FALSE, NOW(), NOW() + INTERVAL '7 days')
            ON CONFLICT (email) DO UPDATE SET
              token = EXCLUDED.token,
              is_completed = FALSE,
              created_at = NOW(),
              expires_at = NOW() + INTERVAL '7 days'
          `, [email, activationToken]);
          tokensGenerated++;
        }
      }

      // Compute scoring
      await ScoringService.computeAndSave(requirementId);
    }

    console.log('Backfill finished successfully:');
    console.log(`- Created requirements: ${created}`);
    console.log(`- Updated requirements: ${updated}`);
    console.log(`- Linked to users: ${linked}`);
    console.log(`- Activation tokens generated: ${tokensGenerated}`);
  } catch (error) {
    console.error('Backfill failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
