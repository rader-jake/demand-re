import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database';
import { ScoringService } from '../services/scoring';

import {
  parseCSV,
  normalizeBusinessType,
  normalizeOperatingStatus,
  parseLocations,
  parseSpaceTypes,
  parseSqftRange,
  parseBudgetRange,
  parseTimeline,
  parseContactPermission,
  parsePhone,
  getColIndex
} from '../utils/metaCsvHelper';

async function run() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Error: Please specify the path to the CSV file.');
    console.error('Example: npm run import:meta-csv -- ./imports/meta-leads.csv');
    process.exit(1);
  }

  const filePath = path.resolve(args[0]);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found at path: ${filePath}`);
    process.exit(1);
  }

  console.log(`Starting Meta CSV Import from file: ${filePath}...`);
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const parsedRows = parseCSV(fileContent);

  if (parsedRows.length <= 1) {
    console.error('Error: CSV file is empty or has no data rows.');
    process.exit(1);
  }

  const headers = parsedRows[0].map(h => h.trim().toLowerCase());
  const dataRows = parsedRows.slice(1).filter(row => row.some(cell => cell.trim() !== ''));

  console.log(`Parsed ${dataRows.length} data rows from CSV.`);

  const idxId = getColIndex(headers, ['id']);
  const idxCreatedTime = getColIndex(headers, ['created_time', 'createdtime']);
  const idxFullName = getColIndex(headers, ['full_name', 'fullname']);
  const idxEmail = getColIndex(headers, ['email']);
  const idxPhone = getColIndex(headers, ['phone_number', 'phone', 'contact_number']);
  const idxBusinessType = getColIndex(headers, ['what_type_of_business_are_you_building_or_operating?', 'business_type', 'business']);
  const idxOperatingStatus = getColIndex(headers, ['are_you_currently_operating?', 'operating_status']);
  const idxLocation = getColIndex(headers, ['where_are_you_looking?', 'location', 'desired_location']);
  const idxSpaceType = getColIndex(headers, ['what_kind_of_space_are_you_looking_for?', 'space_type', 'space_use']);
  const idxSpaceSize = getColIndex(headers, ['roughly_how_much_space_do_you_need?', 'space_size', 'sqft']);
  const idxBudget = getColIndex(headers, ['what_monthly_budget_range_are_you_comfortable_with?', 'monthly_budget', 'budget']);
  const idxTimeline = getColIndex(headers, ['when_are_you_hoping_to_move?', 'move_timeline', 'timeline']);
  const idxContactPermission = getColIndex(headers, ['would_you_like_landlords_and_property_owners_to_contact_you_with_matching_opportunities?', 'wants_contact', 'contact_permission']);
  const idxIdealSpace = getColIndex(headers, [
    'describe_your_ideal_space._(example:_bright_corner_storefront_in_williamsburg_for_a_pilates_concept_with_high_foot_traffic)',
    'describe_your_ideal_space...',
    'describe_your_ideal_space',
    'ideal_space_description',
    'ideal space description',
    'describe your ideal space',
  ]);

  // Log column discovery to catch header mismatches early
  console.log('\n--- Column Discovery ---');
  console.log(`  email:               col ${idxEmail}`);
  console.log(`  full_name:           col ${idxFullName}`);
  console.log(`  business_type:       col ${idxBusinessType}`);
  console.log(`  operating_status:    col ${idxOperatingStatus}`);
  console.log(`  location:            col ${idxLocation}`);
  console.log(`  space_type:          col ${idxSpaceType}`);
  console.log(`  space_size:          col ${idxSpaceSize}`);
  console.log(`  budget:              col ${idxBudget}`);
  console.log(`  timeline:            col ${idxTimeline}`);
  console.log(`  contact_permission:  col ${idxContactPermission}`);
  console.log(`  ideal_space_desc:    col ${idxIdealSpace}${idxIdealSpace === -1 ? ' ⚠️  NOT FOUND - descriptions will be null' : ' ✓'}`);
  console.log('------------------------\n');

  if (idxEmail === -1) {
    console.error('Error: CSV must contain an "email" column.');
    process.exit(1);
  }


  const client = await pool.connect();

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let tokensGenerated = 0;


  try {
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      try {
        const rawEmail = idxEmail !== -1 ? row[idxEmail] : '';
        if (!rawEmail || !rawEmail.trim()) {
          console.log(`Row ${i + 2}: Skipped due to missing email.`);
          skipped++;
          continue;
        }

        const email = rawEmail.trim().toLowerCase();
        const rawLeadId = idxId !== -1 ? row[idxId] : '';
        const sourceLeadId = rawLeadId ? rawLeadId.trim() : 'meta_csv_' + Date.now() + '_' + i;

        const rawCreatedTime = idxCreatedTime !== -1 ? row[idxCreatedTime] : '';
        let createdTime = new Date();
        if (rawCreatedTime) {
          const parsedDate = new Date(rawCreatedTime);
          if (!isNaN(parsedDate.getTime())) {
            createdTime = parsedDate;
          }
        }

        const rawFullName = idxFullName !== -1 ? row[idxFullName] : '';
        const fullName = rawFullName ? rawFullName.trim() : 'Anonymous';

        const rawPhone = idxPhone !== -1 ? row[idxPhone] : '';
        const phone = parsePhone(rawPhone);

        const rawBusinessType = idxBusinessType !== -1 ? row[idxBusinessType] : '';
        const businessType = normalizeBusinessType(rawBusinessType);

        const rawOperatingStatus = idxOperatingStatus !== -1 ? row[idxOperatingStatus] : '';
        const operatingStatus = normalizeOperatingStatus(rawOperatingStatus);

        // location_count rules
        const indicatesFirstLocation = operatingStatus === 'Concept / Planning' || operatingStatus === 'Opening First Location';
        const locationCount = indicatesFirstLocation ? 0 : 1;

        const rawLocation = idxLocation !== -1 ? row[idxLocation] : '';
        const { boroughs, neighborhoods } = parseLocations(rawLocation);

        const rawSpaceType = idxSpaceType !== -1 ? row[idxSpaceType] : '';
        const spaceTypes = parseSpaceTypes(rawSpaceType);

        const rawSpaceSize = idxSpaceSize !== -1 ? row[idxSpaceSize] : '';
        const { min: minSquareFeet, max: maxSquareFeet, label: squareFeetRangeLabel } = parseSqftRange(rawSpaceSize);
        const idealSquareFeet = maxSquareFeet;

        const rawBudget = idxBudget !== -1 ? row[idxBudget] : '';
        const { min: minMonthlyBudget, max: maxMonthlyBudget, label: budgetRangeLabel } = parseBudgetRange(rawBudget);

        const rawTimeline = idxTimeline !== -1 ? row[idxTimeline] : '';
        const { label: moveTimelineLabel, start: targetMoveStartDate, end: targetMoveEndDate, urgency: urgencyStatus } = parseTimeline(rawTimeline, createdTime);

        const rawContactPermission = idxContactPermission !== -1 ? row[idxContactPermission] : '';
        const contactPermission = parseContactPermission(rawContactPermission);

        const rawIdealSpace = idxIdealSpace !== -1 ? row[idxIdealSpace] : '';
        const idealSpaceDescription = rawIdealSpace ? rawIdealSpace.trim() : null;

        // Build raw payload map
        const rawPayload: Record<string, string> = {};
        headers.forEach((header, index) => {
          if (index < row.length) {
            rawPayload[header] = row[index];
          }
        });

        // Log unmapped values to console
        if (businessType === 'Other' && rawBusinessType && rawBusinessType.toLowerCase().trim() !== 'other') {
          console.log(`[Unmapped Business Type] Raw: "${rawBusinessType}" mapped to "Other" for lead ID: ${sourceLeadId}`);
        }
        if (operatingStatus === 'Other' && rawOperatingStatus && rawOperatingStatus.toLowerCase().trim() !== 'other') {
          console.log(`[Unmapped Operating Status] Raw: "${rawOperatingStatus}" mapped to "Other" for lead ID: ${sourceLeadId}`);
        }
        if (spaceTypes.length === 1 && spaceTypes[0] === 'Other' && rawSpaceType && rawSpaceType.toLowerCase().trim() !== 'other' && rawSpaceType.toLowerCase().trim() !== 'flexible') {
          console.log(`[Unmapped Space Type] Raw: "${rawSpaceType}" mapped to "Other" for lead ID: ${sourceLeadId}`);
        }
        if (squareFeetRangeLabel === 'Not sure yet' && rawSpaceSize && rawSpaceSize.toLowerCase().trim() !== 'not_sure' && rawSpaceSize.toLowerCase().trim() !== 'not sure') {
          console.log(`[Unmapped Square Footage] Raw: "${rawSpaceSize}" mapped to "Not sure yet" for lead ID: ${sourceLeadId}`);
        }
        if (budgetRangeLabel === 'Not sure yet' && rawBudget && rawBudget.toLowerCase().trim() !== 'not_sure' && rawBudget.toLowerCase().trim() !== 'not sure') {
          console.log(`[Unmapped Budget] Raw: "${rawBudget}" mapped to "Not sure yet" for lead ID: ${sourceLeadId}`);
        }
        if (moveTimelineLabel === 'Just exploring' && rawTimeline && rawTimeline.toLowerCase().trim() !== 'just_exploring' && rawTimeline.toLowerCase().trim() !== 'just exploring') {
          console.log(`[Unmapped Timeline] Raw: "${rawTimeline}" mapped to "Just exploring" for lead ID: ${sourceLeadId}`);
        }

        // Link user if exists
        const userRes = await client.query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
        const userId = userRes.rows.length > 0 ? userRes.rows[0].id : null;

        // Check if source_lead_id already exists in tenant_requirements
        const existingRes = await client.query('SELECT id FROM tenant_requirements WHERE source_lead_id = $1', [sourceLeadId]);

        let requirementId: string;

        if (existingRes.rows.length > 0) {
          requirementId = existingRes.rows[0].id;

          await client.query(`
            UPDATE tenant_requirements SET
              full_name = $1, email = $2, phone = $3, business_type = $4, operating_status = $5,
              location_count = $6, boroughs = $7, neighborhoods = $8, space_types = $9,
              min_square_feet = $10, max_square_feet = $11, ideal_square_feet = $12,
              min_monthly_budget = $13, max_monthly_budget = $14,
              move_timeline_label = $15, target_move_start_date = $16, target_move_end_date = $17,
              ideal_space_description = $18, contact_permission = $19,
              budget_range_label = $20, square_feet_range_label = $21,
              user_id = COALESCE(user_id, $22), last_confirmed_at = $23,
              raw_payload = $24, urgency_status = $25, updated_at = NOW()
            WHERE id = $26
          `, [
            fullName, email, phone, businessType, operatingStatus,
            locationCount, JSON.stringify(boroughs), JSON.stringify(neighborhoods), JSON.stringify(spaceTypes),
            minSquareFeet, maxSquareFeet, idealSquareFeet,
            minMonthlyBudget, maxMonthlyBudget,
            moveTimelineLabel, targetMoveStartDate, targetMoveEndDate,
            idealSpaceDescription, contactPermission,
            budgetRangeLabel, squareFeetRangeLabel,
            userId, createdTime, JSON.stringify(rawPayload), urgencyStatus, requirementId
          ]);
          updated++;
        } else {
          const insertRes = await client.query<{ id: string }>(`
            INSERT INTO tenant_requirements (
              source, source_lead_id, full_name, email, phone, business_type, operating_status,
              location_count, boroughs, neighborhoods, location_flexibility, space_types,
              min_square_feet, max_square_feet, ideal_square_feet,
              min_monthly_budget, max_monthly_budget, budget_flexibility,
              move_timeline_label, target_move_start_date, target_move_end_date,
              urgency_status, ideal_space_description, contact_permission,
              status, freshness_status, budget_range_label, square_feet_range_label,
              user_id, raw_payload, last_confirmed_at
            ) VALUES (
              'meta_csv_import', $1, $2, $3, $4, $5, $6, $7, $8, $9, 'flexible', $10,
              $11, $12, $13, $14, $15, 'flexible', $16, $17, $18, $19, $20, $21,
              'New', 'Fresh', $22, $23, $24, $25, $26
            ) RETURNING id
          `, [
            sourceLeadId, fullName, email, phone, businessType, operatingStatus,
            locationCount, JSON.stringify(boroughs), JSON.stringify(neighborhoods), JSON.stringify(spaceTypes),
            minSquareFeet, maxSquareFeet, idealSquareFeet,
            minMonthlyBudget, maxMonthlyBudget,
            moveTimelineLabel, targetMoveStartDate, targetMoveEndDate,
            urgencyStatus, idealSpaceDescription, contactPermission,
            budgetRangeLabel, squareFeetRangeLabel,
            userId, JSON.stringify(rawPayload), createdTime
          ]);
          requirementId = insertRes.rows[0].id;
          imported++;
        }

        // Handle activation token if user doesn't exist
        if (!userId) {
          const tokenCheck = await client.query(
            `SELECT token FROM account_activations
             WHERE LOWER(email) = $1 AND is_completed = FALSE AND expires_at > NOW()`,
            [email]
          );

          let activationToken = tokenCheck.rows.length > 0 ? tokenCheck.rows[0].token : null;
          if (!activationToken) {
            activationToken = uuidv4();
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
          const frontendUrl = (process.env.FRONTEND_URL || 'https://demand-re.com').replace(/\/+$/, '');
          const activationUrl = `${frontendUrl}/activate?email=${encodeURIComponent(email)}&token=${activationToken}`;
          console.log(`[Activation Token] Lead: "${fullName}" (${email}) -> Activation URL: ${activationUrl}`);
        }

        // Compute scores
        try {
          await ScoringService.computeAndSave(requirementId);
        } catch (scoreErr) {
          console.error(`Failed to calculate scoring for requirement ${requirementId}:`, scoreErr);
        }

      } catch (rowErr) {
        console.error(`Row ${i + 2} failed to import:`, rowErr);
        failed++;
      }
    }

    console.log('\n--- CSV Import Summary ---');
    console.log(`Successfully Imported (New): ${imported}`);
    console.log(`Successfully Updated (Existing): ${updated}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Failed: ${failed}`);
    console.log(`Activation Tokens Generated: ${tokensGenerated}`);
    console.log('-------------------------\n');

  } catch (err) {
    console.error('Import failed with fatal error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
