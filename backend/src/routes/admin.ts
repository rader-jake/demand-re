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

export default router;
