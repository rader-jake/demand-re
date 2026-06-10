import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import logger from '../utils/logger';

const router = Router();

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
  const business_type = getFieldByKeyword(fieldData, ['business_type', 'business', 'industry']) || null;
  const currently_operating = getFieldByKeyword(fieldData, ['currently_operating', 'operating', 'is_operating']) || null;
  const desired_location = getFieldByKeyword(fieldData, ['desired_location', 'location', 'preferred_location']) || null;
  const space_type = getFieldByKeyword(fieldData, ['space_type', 'space_use', 'use_type']) || null;
  const space_size = getFieldByKeyword(fieldData, ['space_size', 'sqft', 'square_feet', 'size']) || null;
  const monthly_budget = getFieldByKeyword(fieldData, ['monthly_budget', 'budget', 'rent_budget']) || null;
  const move_timeline = getFieldByKeyword(fieldData, ['move_timeline', 'timeline', 'timeline_notes']) || null;
  
  const wantsContactVal = getFieldByKeyword(fieldData, ['wants_contact', 'contact_me', 'contact_opt_in']);
  let wants_contact = false;
  if (wantsContactVal) {
    const lowerVal = wantsContactVal.toLowerCase().trim();
    wants_contact = ['true', 'yes', 'y', '1', 'on'].includes(lowerVal);
  }

  const ideal_space_description = getFieldByKeyword(fieldData, ['ideal_space_description', 'description', 'notes', 'comments']) || null;

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

  const upsertResult = await query<{ id: string; lead_status: string; user_id: string }>(upsertQuery, values);
  logger.info(`Lead gen successfully ingested/updated: id=${upsertResult.rows[0].id}, email=${normalizedEmail}, status=${upsertResult.rows[0].lead_status}, user_id=${upsertResult.rows[0].user_id}`);
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
