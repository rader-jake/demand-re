import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/admin/users
router.get('/users', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { role, search, page = '1', limit = '50' } = req.query as Record<string, string>;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  if (role) { conditions.push(`role = $${p++}`); params.push(role); }
  if (search) {
    conditions.push(`(email ILIKE $${p} OR first_name ILIKE $${p} OR last_name ILIKE $${p})`);
    params.push(`%${search}%`); p++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const [users, count] = await Promise.all([
    query(
      `SELECT id, email, role, first_name, last_name, is_verified, is_active, last_login_at, created_at
       FROM users ${where} ORDER BY created_at DESC LIMIT $${p} OFFSET $${p + 1}`,
      [...params, parseInt(limit), offset]
    ),
    query(`SELECT COUNT(*) AS total FROM users ${where}`, params),
  ]);

  res.json({
    users: users.rows,
    pagination: {
      total: parseInt((count.rows[0] as { total: string }).total),
      page: parseInt(page),
      limit: parseInt(limit),
    },
  });
});

// PUT /api/admin/users/:id/status
router.put('/users/:id/status', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { isActive } = req.body;
  await query('UPDATE users SET is_active = $1 WHERE id = $2', [isActive, req.params.id]);
  res.json({ message: 'User status updated' });
});

// GET /api/admin/analytics/overview
router.get('/analytics/overview', authenticate, requireAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  const [
    userStats, tenantStats, landlordStats,
    interestStats, messageStats, recentEvents,
  ] = await Promise.all([
    query(`
      SELECT
        COUNT(*) AS total_users,
        COUNT(*) FILTER (WHERE role = 'tenant') AS total_tenants,
        COUNT(*) FILTER (WHERE role = 'landlord') AS total_landlords,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS new_this_week,
        COUNT(*) FILTER (WHERE last_login_at > NOW() - INTERVAL '7 days') AS active_this_week
      FROM users WHERE is_active = TRUE
    `),
    query(`
      SELECT
        COUNT(*) AS total_profiles,
        COUNT(*) FILTER (WHERE status = 'active') AS active_profiles,
        COUNT(*) FILTER (WHERE status = 'draft') AS draft_profiles,
        ROUND(AVG(profile_completeness), 1) AS avg_completeness,
        ROUND(AVG(view_count), 1) AS avg_views,
        ROUND(AVG(interest_count), 1) AS avg_interests
      FROM tenant_profiles
    `),
    query(`
      SELECT COUNT(*) AS total FROM landlord_profiles
    `),
    query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE status = 'accepted') AS accepted,
        COUNT(*) FILTER (WHERE status = 'declined') AS declined,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS this_week
      FROM interest_expressions
    `),
    query(`
      SELECT COUNT(*) AS total_messages,
             COUNT(DISTINCT conversation_id) AS total_conversations
      FROM messages
    `),
    query(`
      SELECT event_type, COUNT(*) AS count
      FROM user_events
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY event_type
      ORDER BY count DESC
    `),
  ]);

  res.json({
    users: userStats.rows[0],
    tenants: tenantStats.rows[0],
    landlords: landlordStats.rows[0],
    interests: interestStats.rows[0],
    messages: messageStats.rows[0],
    recentEvents: recentEvents.rows,
  });
});

// GET /api/admin/analytics/demand-heatmap
router.get('/analytics/demand-heatmap', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { period = '30' } = req.query as { period?: string };

  const result = await query(`
    SELECT
      tsr.preferred_neighborhoods,
      tp.industry,
      tp.space_use_type,
      COUNT(*) AS tenant_count,
      ROUND(AVG(tsr.budget_psf_min), 2) AS avg_budget_psf_min,
      ROUND(AVG(tsr.budget_psf_max), 2) AS avg_budget_psf_max,
      ROUND(AVG(tsr.sqft_min), 0) AS avg_sqft_min,
      ROUND(AVG(tsr.sqft_max), 0) AS avg_sqft_max
    FROM tenant_profiles tp
    JOIN tenant_space_requirements tsr ON tsr.tenant_profile_id = tp.id
    WHERE tp.status = 'active'
      AND tp.updated_at > NOW() - INTERVAL '${parseInt(period, 10)} days'
    GROUP BY tsr.preferred_neighborhoods, tp.industry, tp.space_use_type
    ORDER BY tenant_count DESC
  `);

  // Also pull precomputed heatmap
  const heatmap = await query(`
    SELECT * FROM demand_heatmap
    WHERE period_start >= NOW() - INTERVAL '${parseInt(period, 10)} days'
    ORDER BY search_count DESC
  `);

  res.json({ liveDemand: result.rows, heatmapData: heatmap.rows });
});

// GET /api/admin/analytics/tenant-insights
router.get('/analytics/tenant-insights', authenticate, requireAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  const [
    byIndustry, byNeighborhood, byFunding, byRevenue, scoreDist, expansion,
  ] = await Promise.all([
    query(`
      SELECT tp.industry, COUNT(*) AS count,
             ROUND(AVG(ts.desirability_index), 1) AS avg_score
      FROM tenant_profiles tp
      LEFT JOIN tenant_scores ts ON ts.tenant_profile_id = tp.id
      WHERE tp.status = 'active'
      GROUP BY tp.industry ORDER BY count DESC
    `),
    query(`
      SELECT UNNEST(tsr.preferred_neighborhoods) AS neighborhood, COUNT(*) AS demand_count
      FROM tenant_space_requirements tsr
      JOIN tenant_profiles tp ON tp.id = tsr.tenant_profile_id
      WHERE tp.status = 'active'
      GROUP BY neighborhood ORDER BY demand_count DESC LIMIT 20
    `),
    query(`
      SELECT funding_status, COUNT(*) AS count
      FROM tenant_profiles WHERE status = 'active' AND funding_status IS NOT NULL
      GROUP BY funding_status ORDER BY count DESC
    `),
    query(`
      SELECT revenue_range, COUNT(*) AS count
      FROM tenant_profiles WHERE status = 'active' AND revenue_range IS NOT NULL
      GROUP BY revenue_range ORDER BY count DESC
    `),
    query(`
      SELECT
        CASE WHEN desirability_index >= 80 THEN 'A (80-100)'
             WHEN desirability_index >= 65 THEN 'B (65-79)'
             WHEN desirability_index >= 50 THEN 'C (50-64)'
             ELSE 'D (<50)' END AS tier,
        COUNT(*) AS count
      FROM tenant_scores GROUP BY tier ORDER BY tier
    `),
    query(`
      SELECT tp.industry, COUNT(*) AS count,
             ROUND(AVG(tp.number_of_locations), 1) AS avg_locations,
             ROUND(AVG(ts.expansion_likelihood_score), 1) AS avg_expansion_score
      FROM tenant_profiles tp
      LEFT JOIN tenant_scores ts ON ts.tenant_profile_id = tp.id
      WHERE tp.status = 'active'
      GROUP BY tp.industry ORDER BY avg_expansion_score DESC NULLS LAST LIMIT 10
    `),
  ]);

  res.json({
    byIndustry: byIndustry.rows,
    byNeighborhood: byNeighborhood.rows,
    byFunding: byFunding.rows,
    byRevenue: byRevenue.rows,
    scoreDistribution: scoreDist.rows,
    expansionLeaders: expansion.rows,
  });
});

// GET /api/admin/analytics/export
router.get('/analytics/export', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { type = 'tenants' } = req.query as { type?: string };

  let data: unknown[];

  if (type === 'tenants') {
    const result = await query(`
      SELECT tp.legal_name, tp.dba_name, tp.industry, tp.space_use_type,
             tp.years_in_operation, tp.number_of_locations, tp.funding_status,
             tp.revenue_range, tp.credit_score_range, tp.status, tp.profile_completeness,
             tsr.preferred_neighborhoods, tsr.sqft_min, tsr.sqft_max,
             tsr.budget_psf_min, tsr.budget_psf_max,
             ts.financial_strength_score, ts.expansion_likelihood_score,
             ts.market_desirability_score, ts.desirability_index,
             tp.created_at
      FROM tenant_profiles tp
      LEFT JOIN tenant_space_requirements tsr ON tsr.tenant_profile_id = tp.id
      LEFT JOIN tenant_scores ts ON ts.tenant_profile_id = tp.id
      ORDER BY tp.created_at DESC
    `);
    data = result.rows;
  } else if (type === 'events') {
    const result = await query(`
      SELECT event_type, entity_type, properties, created_at
      FROM user_events WHERE created_at > NOW() - INTERVAL '30 days'
      ORDER BY created_at DESC LIMIT 10000
    `);
    data = result.rows;
  } else {
    data = [];
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${type}-export-${new Date().toISOString().split('T')[0]}.json"`);
  res.json({ exported_at: new Date().toISOString(), type, count: data.length, data });
});

// GET /api/admin/requirements
// Returns requirements with search, status filtering, and pagination
router.get('/requirements', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { search, lead_status, page = '1', limit = '50' } = req.query as Record<string, string>;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  if (lead_status) {
    conditions.push(`status = $${p++}`);
    params.push(lead_status);
  }

  if (search) {
    conditions.push(`(full_name ILIKE $${p} OR email ILIKE $${p} OR business_type ILIKE $${p} OR move_timeline_label ILIKE $${p})`);
    params.push(`%${search}%`);
    p++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitVal = parseInt(limit, 10);
  const offsetVal = (parseInt(page, 10) - 1) * limitVal;

  const [requirements, count] = await Promise.all([
    query(
      `SELECT *, created_at AS created_time FROM tenant_requirements ${where} ORDER BY created_at DESC LIMIT $${p} OFFSET $${p + 1}`,
      [...params, limitVal, offsetVal]
    ),
    query(`SELECT COUNT(*) AS total FROM tenant_requirements ${where}`, params),
  ]);

  // Keep both keys for compatibility
  res.json({
    leads: requirements.rows.map((r: any) => ({
      ...r,
      lead_status: r.status,
      desired_location: r.neighborhoods ? r.neighborhoods[0] : null,
      space_type: r.space_types ? r.space_types[0] : null,
      space_size: r.max_square_feet ? `${r.min_square_feet}-${r.max_square_feet}` : null,
      monthly_budget: r.max_monthly_budget ? `${r.min_monthly_budget}-${r.max_monthly_budget}` : null,
      move_timeline: r.move_timeline_label,
      phone_number: r.phone
    })),
    requirements: requirements.rows,
    pagination: {
      total: parseInt((count.rows[0] as { total: string }).total, 10),
      page: parseInt(page, 10),
      limit: limitVal,
    },
  });
});

// GET /api/admin/requirements/:id
// Returns single requirement with all associated tenant_matches
router.get('/requirements/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const reqResult = await query('SELECT *, created_at AS created_time FROM tenant_requirements WHERE id = $1', [id]);
  if (reqResult.rows.length === 0) {
    res.status(404).json({ error: 'Requirement not found' });
    return;
  }

  const matchesResult = await query(
    'SELECT * FROM tenant_matches WHERE requirement_id = $1 ORDER BY created_at DESC',
    [id]
  );

  const tr = reqResult.rows[0] as Record<string, any>;
  const leadMapped = {
    ...tr,
    lead_status: tr.status,
    desired_location: tr.neighborhoods ? tr.neighborhoods[0] : null,
    space_type: tr.space_types ? tr.space_types[0] : null,
    space_size: tr.max_square_feet ? `${tr.min_square_feet}-${tr.max_square_feet}` : null,
    monthly_budget: tr.max_monthly_budget ? `${tr.min_monthly_budget}-${tr.max_monthly_budget}` : null,
    move_timeline: tr.move_timeline_label,
    phone_number: tr.phone,
    wants_contact: tr.contact_permission
  };

  res.json({
    ...leadMapped,
    matches: matchesResult.rows,
  });
});

// PATCH /api/admin/requirements/:id
// Updates requirement status
router.patch('/requirements/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { lead_status } = req.body;

  const result = await query(
    'UPDATE tenant_requirements SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [lead_status, id]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Requirement not found' });
    return;
  }

  res.json(result.rows[0]);
});

// POST /api/admin/requirements/:id/matches
// Creates a manual match for a requirement
router.post('/requirements/:id/matches', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const {
    listing_title, listing_url, address, city, state, neighborhood,
    square_feet, rent, space_type, broker_name, broker_phone, broker_email,
    admin_notes, match_score, verification_status
  } = req.body;

  if (!listing_url) {
    res.status(400).json({ error: 'Listing URL is required' });
    return;
  }

  const result = await query(
    `INSERT INTO tenant_matches (
       requirement_id, listing_title, listing_url, address, city, state, neighborhood,
       square_feet, rent, space_type, broker_name, broker_phone, broker_email,
       admin_notes, match_score, verification_status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     RETURNING *`,
    [
      id, listing_title, listing_url, address, city, state, neighborhood,
      square_feet, rent, space_type, broker_name, broker_phone, broker_email,
      admin_notes, match_score !== undefined ? parseInt(match_score, 10) : null,
      verification_status ?? 'needs_review'
    ]
  );

  res.status(201).json(result.rows[0]);
});

// PATCH /api/admin/matches/:matchId
// Updates listing match parameters
router.patch('/matches/:matchId', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { matchId } = req.params;
  const fields = req.body;

  const allowedFields = [
    'listing_title', 'listing_url', 'address', 'city', 'state', 'neighborhood',
    'square_feet', 'rent', 'space_type', 'broker_name', 'broker_phone', 'broker_email',
    'admin_notes', 'match_score', 'verification_status', 'tenant_sent'
  ];

  const keys = Object.keys(fields).filter(key => allowedFields.includes(key));
  if (keys.length === 0) {
    res.status(400).json({ error: 'No valid update fields provided' });
    return;
  }

  const sets = keys.map((key, idx) => `"${key}" = $${idx + 2}`);
  const values = keys.map(key => {
    if (key === 'match_score' && fields[key] !== null && fields[key] !== undefined) {
      return parseInt(fields[key], 10);
    }
    return fields[key];
  });

  const result = await query(
    `UPDATE tenant_matches SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
    [matchId, ...values]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Match not found' });
    return;
  }

  res.json(result.rows[0]);
});

// DELETE /api/admin/matches/:matchId
// Deletes a match
router.delete('/matches/:matchId', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { matchId } = req.params;

  const result = await query('DELETE FROM tenant_matches WHERE id = $1 RETURNING id', [matchId]);
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Match not found' });
    return;
  }

  res.json({ message: 'Match deleted successfully', id: matchId });
});

// POST /api/admin/requirements/:id/send-matches
// Generates matches email preview, marks matches as sent, and updates status
router.post('/requirements/:id/send-matches', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { matchIds } = req.body;

  if (!Array.isArray(matchIds) || matchIds.length === 0) {
    res.status(400).json({ error: 'No match IDs provided' });
    return;
  }

  const reqResult = await query('SELECT * FROM tenant_requirements WHERE id = $1', [id]);
  if (reqResult.rows.length === 0) {
    res.status(404).json({ error: 'Requirement not found' });
    return;
  }
  const requirement = reqResult.rows[0] as Record<string, any>;

  const matchesResult = await query(
    'SELECT * FROM tenant_matches WHERE requirement_id = $1 AND id = ANY($2)',
    [id, matchIds]
  );
  const matches = matchesResult.rows;

  if (matches.length === 0) {
    res.status(400).json({ error: 'No matching records found to send' });
    return;
  }

  // Mark selected matches as sent
  await query(
    'UPDATE tenant_matches SET tenant_sent = true WHERE requirement_id = $1 AND id = ANY($2)',
    [id, matchIds]
  );

  // Update status to matches_sent
  await query(
    "UPDATE tenant_requirements SET status = 'Matches Sent' WHERE id = $1",
    [id]
  );

  // Generate Email Preview (mock send)
  const tenantName = requirement.full_name || 'Tenant';
  const subject = `Curated space matches for your requirements - Demand RE`;

  let textBody = `Hi ${tenantName},\n\n`;
  textBody += `We have manually reviewed your business requirements and found some matches for you:\n\n`;

  matches.forEach((match: any, index: number) => {
    textBody += `${index + 1}. ${match.listing_title || 'Commercial Listing'}\n`;
    if (match.address) textBody += `   Address: ${match.address}${match.city ? `, ${match.city}` : ''}${match.state ? ` ${match.state}` : ''}\n`;
    if (match.square_feet) textBody += `   Size: ${match.square_feet} sq ft\n`;
    if (match.rent) textBody += `   Rent: ${match.rent}\n`;
    if (match.space_type) textBody += `   Type: ${match.space_type}\n`;
    if (match.listing_url) textBody += `   Link: ${match.listing_url}\n`;
    if (match.broker_name) textBody += `   Broker: ${match.broker_name}${match.broker_phone ? ` (${match.broker_phone})` : ''}${match.broker_email ? ` (${match.broker_email})` : ''}\n`;
    if (match.admin_notes) textBody += `   Notes: ${match.admin_notes}\n`;
    textBody += `\n`;
  });

  textBody += `Let us know if you would like to tour any of these spaces or need further assistance!\n\n`;
  textBody += `Best regards,\n`;
  textBody += `Demand RE Team`;

  let htmlBody = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">`;
  htmlBody += `<h2 style="color: #0d2149;">Hi ${tenantName},</h2>`;
  htmlBody += `<p>We have manually reviewed your business requirements and found some matches for you:</p>`;

  matches.forEach((match: any) => {
    htmlBody += `<div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 16px; background-color: #f8fafc;">`;
    htmlBody += `<h3 style="margin-top: 0; color: #0d2149;">${match.listing_title || 'Commercial Space'}</h3>`;
    htmlBody += `<ul style="list-style-type: none; padding-left: 0; margin-bottom: 12px;">`;
    if (match.address) htmlBody += `<li><strong>Address:</strong> ${match.address}${match.city ? `, ${match.city}` : ''}${match.state ? ` ${match.state}` : ''}</li>`;
    if (match.square_feet) htmlBody += `<li><strong>Size:</strong> ${match.square_feet} sq ft</li>`;
    if (match.rent) htmlBody += `<li><strong>Rent:</strong> ${match.rent}</li>`;
    if (match.space_type) htmlBody += `<li><strong>Space Type:</strong> ${match.space_type}</li>`;
    if (match.broker_name) htmlBody += `<li><strong>Broker:</strong> ${match.broker_name}${match.broker_phone ? ` (${match.broker_phone})` : ''}${match.broker_email ? ` (${match.broker_email})` : ''}</li>`;
    htmlBody += `</ul>`;
    if (match.admin_notes) htmlBody += `<p style="margin-bottom: 12px; padding: 8px 12px; border-left: 3px solid #60a5fa; background-color: #eff6ff; font-size: 14px;"><em>Notes: ${match.admin_notes}</em></p>`;
    if (match.listing_url) htmlBody += `<a href="${match.listing_url}" target="_blank" style="display: inline-block; padding: 8px 16px; font-size: 14px; font-weight: bold; color: #fff; background-color: #2563eb; text-decoration: none; border-radius: 8px;">View Listing Details</a>`;
    htmlBody += `</div>`;
  });

  htmlBody += `<p>Please let us know if you would like to schedule a tour for any of these options or need more matches!</p>`;
  htmlBody += `<p style="margin-top: 24px;">Best regards,<br/><strong>Demand RE Admin Team</strong></p>`;
  htmlBody += `</div>`;

  res.json({
    preview: {
      to: requirement.email,
      subject,
      text: textBody,
      html: htmlBody,
    },
  });
});

export default router;
