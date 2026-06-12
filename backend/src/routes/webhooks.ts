import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import logger from '../utils/logger';
import { normalizeOperatingStatus } from '../utils/normalize';

const router = Router();

// Helper to map space type string to database enum
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

// Helper to find a field value in field_data by checking matching keyword prefixes/substrings
function getFieldByKeyword(fieldData: any[], keywords: string[]): string | undefined {
  const field = fieldData.find((f: any) => {
    if (!f || !f.name) return false;
    const lowerName = f.name.toLowerCase();
    return keywords.some(keyword => lowerName === keyword || lowerName.includes(keyword));
  });
  return field && field.values && field.values.length > 0 ? field.values[0] : undefined;
}

// Fetch lead detail from Facebook Graph API using the PAGE token
async function fetchLeadgenDetails(leadgenId: string): Promise<any> {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) {
    throw new Error('META_PAGE_ACCESS_TOKEN environment variable is not set');
  }
  // Construct URL. We must be careful never to log this URL as it contains the secret access token.
  const url = `https://graph.facebook.com/v19.0/${leadgenId}?access_token=${token}`;

  logger.info(`Fetching details from Meta Graph API for leadgen_id: ${leadgenId}`);
  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Graph API returned status ${response.status}: ${errorText}`);
  }
  return response.json();
}

// Process lead details: map to database schema and upsert
async function processLeadDetails(leadData: any, rawPayload: any): Promise<void> {
  const meta_lead_id = leadData.id || leadData.leadgen_id;
  if (!meta_lead_id) {
    throw new Error('No valid lead ID (id or leadgen_id) found in lead data');
  }

  const created_time = leadData.created_time ? new Date(leadData.created_time) : new Date();
  const ad_id = leadData.ad_id || null;
  const ad_name = leadData.ad_name || null;
  const adset_id = leadData.adset_id || null;
  const adset_name = leadData.adset_name || null;
  const campaign_id = leadData.campaign_id || null;
  const campaign_name = leadData.campaign_name || null;
  const form_id = leadData.form_id || null;
  const form_name = leadData.form_name || null;
  const platform = leadData.platform || null;
  const is_organic = leadData.is_organic ?? null;

  const fieldData = leadData.field_data || [];

  const email = getFieldByKeyword(fieldData, ['email']);
  if (!email) {
    logger.warn(`Skipping lead ingestion for leadgen_id ${meta_lead_id} because no email field was found.`);
    return;
  }
  const normalizedEmail = email.trim().toLowerCase();

  const full_name = getFieldByKeyword(fieldData, ['full_name', 'fullname', 'name']) || null;
  const phone_number = getFieldByKeyword(fieldData, ['phone_number', 'phone', 'contact_number']) || null;
  const business_type = getFieldByKeyword(fieldData, ['business_type', 'business', 'building_or_operating', 'building', 'what_type_of_business_are_you_building_or_operating']) || null;
  const raw_currently_operating = getFieldByKeyword(fieldData, ['operating_status', 'operating', 'currently_operating', 'are_you_currently_operating']) || null;
  const currently_operating = normalizeOperatingStatus(raw_currently_operating);
  const desired_location = getFieldByKeyword(fieldData, ['desired_location', 'location', 'looking', 'where_are_you_looking']) || null;
  const space_type = getFieldByKeyword(fieldData, ['space_type', 'space_use', 'space_are_you_looking_for', 'space_types', 'what_kind_of_space_are_you_looking_for']) || null;
  const space_size = getFieldByKeyword(fieldData, ['space_size', 'sqft', 'size', 'how_much_space', 'roughly_how_much_space_do_you_need']) || null;
  const monthly_budget = getFieldByKeyword(fieldData, ['monthly_budget', 'budget', 'budget_range', 'what_monthly_budget_range_are_you_comfortable_with']) || null;
  const move_timeline = getFieldByKeyword(fieldData, ['move_timeline', 'timeline', 'hoping_to_move', 'when_are_you_hoping_to_move']) || null;

  const wantsContactVal = getFieldByKeyword(fieldData, ['wants_contact', 'contact', 'contact_permission', 'would_you_like_landlords_and_property_owners_to_contact_you_with_matching_opportunities']);
  let wants_contact = false;
  if (wantsContactVal) {
    const lowerVal = wantsContactVal.toLowerCase().trim();
    wants_contact = ['true', 'yes', 'y', '1', 'on'].includes(lowerVal);
  }

  const ideal_space_description = getFieldByKeyword(fieldData, ['ideal_space_description', 'description', 'ideal_space', 'describe_your_ideal_space']) || null;

  // Search if a registered user already exists with this email
  const userResult = await query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
  const user_id = userResult.rows.length > 0 ? userResult.rows[0].id : null;
  const lead_status = user_id ? 'linked' : 'new';

  const upsertQuery = `
    INSERT INTO meta_leads (
      meta_lead_id, created_time, ad_id, ad_name, adset_id, adset_name,
      campaign_id, campaign_name, form_id, form_name, platform, is_organic,
      full_name, email, phone_number, business_type, currently_operating,
      desired_location, space_type, space_size, monthly_budget, move_timeline,
      wants_contact, ideal_space_description, lead_status, raw_payload, user_id
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
    )
    ON CONFLICT (meta_lead_id) DO UPDATE SET
      created_time = EXCLUDED.created_time,
      ad_id = EXCLUDED.ad_id,
      ad_name = EXCLUDED.ad_name,
      adset_id = EXCLUDED.adset_id,
      adset_name = EXCLUDED.adset_name,
      campaign_id = EXCLUDED.campaign_id,
      campaign_name = EXCLUDED.campaign_name,
      form_id = EXCLUDED.form_id,
      form_name = EXCLUDED.form_name,
      platform = EXCLUDED.platform,
      is_organic = EXCLUDED.is_organic,
      full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      phone_number = EXCLUDED.phone_number,
      business_type = EXCLUDED.business_type,
      currently_operating = EXCLUDED.currently_operating,
      desired_location = EXCLUDED.desired_location,
      space_type = EXCLUDED.space_type,
      space_size = EXCLUDED.space_size,
      monthly_budget = EXCLUDED.monthly_budget,
      move_timeline = EXCLUDED.move_timeline,
      wants_contact = EXCLUDED.wants_contact,
      ideal_space_description = EXCLUDED.ideal_space_description,
      raw_payload = EXCLUDED.raw_payload,
      user_id = COALESCE(meta_leads.user_id, EXCLUDED.user_id),
      lead_status = CASE WHEN meta_leads.user_id IS NOT NULL OR EXCLUDED.user_id IS NOT NULL THEN 'linked' ELSE meta_leads.lead_status END,
      updated_at = NOW()
    RETURNING id, lead_status, user_id;
  `;

  const values = [
    meta_lead_id, created_time, ad_id, ad_name, adset_id, adset_name,
    campaign_id, campaign_name, form_id, form_name, platform, is_organic,
    full_name, normalizedEmail, phone_number, business_type, currently_operating,
    desired_location, space_type, space_size, monthly_budget, move_timeline,
    wants_contact, ideal_space_description, lead_status, JSON.stringify(rawPayload), user_id
  ];

  await query(upsertQuery, values);

  // Parse location and budget details for tenant_requirements
  const boroughs: string[] = [];
  if (desired_location) {
    const lowerLoc = desired_location.toLowerCase();
    if (lowerLoc.includes('brooklyn')) boroughs.push('Brooklyn');
    if (lowerLoc.includes('manhattan')) boroughs.push('Manhattan');
    if (lowerLoc.includes('queens')) boroughs.push('Queens');
    if (lowerLoc.includes('bronx')) boroughs.push('Bronx');
    if (lowerLoc.includes('staten')) boroughs.push('Staten Island');
  }
  const neighborhoods = desired_location ? [desired_location] : [];

  const { min: minSqft, max: maxSqft } = parseSqft(space_size);
  const idealSqft = maxSqft;

  const { min: minBud, max: maxBud } = parseBudget(monthly_budget);

  let startMove: Date | null = new Date();
  let endMove: Date | null = new Date();
  let urgency = 'medium';
  if (move_timeline) {
    const lowerTimeline = move_timeline.toLowerCase();
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
  const mappedSpaceType = space_type ? mapSpaceUseType(space_type) : 'office';
  const spaceTypesJson = JSON.stringify([mappedSpaceType]);
  const status = 'New';

  const checkReq = await query('SELECT id FROM tenant_requirements WHERE source_lead_id = $1', [meta_lead_id]);

  let reqId: string;
  if (checkReq.rows.length > 0) {
    reqId = checkReq.rows[0].id as string;
    await query(`
      UPDATE tenant_requirements SET
        full_name = $1, email = $2, phone = $3, business_type = $4, operating_status = $5,
        boroughs = $6, neighborhoods = $7, space_types = $8,
        min_square_feet = $9, max_square_feet = $10, ideal_square_feet = $11,
        min_monthly_budget = $12, max_monthly_budget = $13,
        move_timeline_label = $14, target_move_start_date = $15, target_move_end_date = $16,
        urgency_status = $17, ideal_space_description = $18, contact_permission = $19,
        user_id = COALESCE(tenant_requirements.user_id, $20), updated_at = NOW()
      WHERE id = $21
    `, [
      full_name, normalizedEmail, phone_number, business_type, currently_operating,
      JSON.stringify(boroughs), JSON.stringify(neighborhoods), spaceTypesJson,
      minSqft, maxSqft, idealSqft,
      minBud, maxBud,
      move_timeline, startMove, endMove,
      urgency, ideal_space_description, wants_contact,
      user_id, reqId
    ]);
  } else {
    const insertReqResult = await query<{ id: string }>(`
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
      'meta', meta_lead_id, full_name, normalizedEmail, phone_number, business_type, currently_operating,
      JSON.stringify(boroughs), JSON.stringify(neighborhoods), 'flexible', spaceTypesJson,
      minSqft, maxSqft, idealSqft,
      minBud, maxBud, 'flexible',
      move_timeline, startMove, endMove,
      urgency, ideal_space_description, wants_contact,
      status, freshness, user_id
    ]);
    reqId = insertReqResult.rows[0].id;
  }

  if (!user_id) {
    const token = uuidv4();
    await query(`
      INSERT INTO account_activations (email, token, is_completed, created_at, expires_at)
      VALUES ($1, $2, FALSE, NOW(), NOW() + INTERVAL '7 days')
      ON CONFLICT (email) DO UPDATE SET
        token = EXCLUDED.token,
        is_completed = FALSE,
        created_at = NOW(),
        expires_at = NOW() + INTERVAL '7 days'
    `, [normalizedEmail, token]);

    const frontendUrl = (process.env.FRONTEND_URL || 'https://demand-re.com').replace(/\/+$/, '');
    const activationLink = `${frontendUrl}/activate?email=${encodeURIComponent(normalizedEmail)}&token=${token}`;
    logger.info(`
=========================================
EMAIL: Activate Your Demand RE Account
TO: ${normalizedEmail}
SUBJECT: Activate Your Demand RE Account
BODY:
Your space requirements have been securely saved.

Activate your account to:
* Track your request
* Receive matching opportunities
* Update your requirements
* Connect with landlords

Activation Link:
${activationLink}
=========================================
    `);
  }
}

// Background handler for incoming webhook payloads
async function handleIncomingWebhook(body: any): Promise<void> {
  if (!body || body.object !== 'page') {
    logger.warn('Received webhook payload with invalid object type:', body?.object);
    return;
  }

  const entries = body.entry || [];
  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const change of changes) {
      if (change.field === 'leadgen') {
        const leadgenValue = change.value;
        if (!leadgenValue || !leadgenValue.leadgen_id) {
          logger.warn('Invalid leadgen change value received:', leadgenValue);
          continue;
        }

        const leadgenId = leadgenValue.leadgen_id;
        try {
          const leadDetails = await fetchLeadgenDetails(leadgenId);
          await processLeadDetails(leadDetails, leadDetails);
        } catch (error: any) {
          logger.error(`Failed to ingest leadgen_id ${leadgenId}: ${error.message}`);
        }
      }
    }
  }
}

// GET /api/webhooks/meta-leads - Meta verification
router.get('/meta-leads', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('Meta Lead Ads Webhook verified successfully');
    res.status(200).send(challenge);
    return;
  }
  logger.warn('Meta Lead Ads Webhook verification failed: verify_token mismatch or invalid mode');
  res.status(403).json({ error: 'Verification failed' });
});

// POST /api/webhooks/meta-leads - Meta lead notifications
router.post('/meta-leads', (req: Request, res: Response) => {
  // Acknowledge receipt to Meta quickly (within their timeout limits)
  res.status(200).json({ received: true });

  // Process the webhook in the background
  handleIncomingWebhook(req.body).catch(err => {
    logger.error('Error handling Meta Lead Webhook in background:', err);
  });
});

// POST /api/webhooks/meta-leads/test-simulate - Development simulation endpoint
if (process.env.NODE_ENV === 'development') {
  router.post('/meta-leads/test-simulate', async (req: Request, res: Response): Promise<void> => {
    try {
      const mockLeadData = req.body;
      if (!mockLeadData || (!mockLeadData.leadgen_id && !mockLeadData.id)) {
        res.status(400).json({ error: 'Missing leadgen_id/id in request body' });
        return;
      }

      const leadDetails = {
        id: mockLeadData.leadgen_id || mockLeadData.id,
        created_time: mockLeadData.created_time || new Date().toISOString(),
        ad_id: mockLeadData.ad_id || 'mock_ad_id',
        ad_name: mockLeadData.ad_name || 'Mock Ad',
        adset_id: mockLeadData.adset_id || 'mock_adset_id',
        adset_name: mockLeadData.adset_name || 'Mock Adset',
        campaign_id: mockLeadData.campaign_id || 'mock_campaign_id',
        campaign_name: mockLeadData.campaign_name || 'Mock Campaign',
        form_id: mockLeadData.form_id || 'mock_form_id',
        form_name: mockLeadData.form_name || 'Mock Form',
        platform: mockLeadData.platform || 'fb',
        is_organic: mockLeadData.is_organic ?? false,
        field_data: mockLeadData.field_data || []
      };

      await processLeadDetails(leadDetails, mockLeadData);
      res.json({ success: true, message: 'Mock lead successfully processed and ingested.' });
    } catch (error: any) {
      logger.error('Error simulating lead webhook:', error);
      res.status(500).json({ error: error.message });
    }
  });
}

export default router;
