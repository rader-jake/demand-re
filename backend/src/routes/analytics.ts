import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { AnalyticsService } from '../services/analytics';

const router = Router();

// GET /api/analytics/trends
router.get('/trends', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { metric = 'tenants', days = '30' } = req.query as Record<string, string>;

  const validMetrics = ['tenants', 'searches', 'interests'] as const;
  if (!validMetrics.includes(metric as typeof validMetrics[number])) {
    res.status(400).json({ error: 'Invalid metric' });
    return;
  }

  const data = await AnalyticsService.getTrend(
    metric as typeof validMetrics[number],
    parseInt(days, 10)
  );
  res.json({ metric, days: parseInt(days, 10), data });
});

// GET /api/analytics/neighborhood-demand
router.get('/neighborhood-demand', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { industry, spaceUseType } = req.query as Record<string, string>;

  const conditions: string[] = ['tp.status = $1'];
  const params: unknown[] = ['active'];
  let p = 2;

  if (industry) { conditions.push(`tp.industry ILIKE $${p++}`); params.push(`%${industry}%`); }
  if (spaceUseType) { conditions.push(`tp.space_use_type = $${p++}`); params.push(spaceUseType); }

  const result = await query(`
    SELECT
      UNNEST(tsr.preferred_neighborhoods) AS neighborhood,
      COUNT(*) AS demand_count,
      ROUND(AVG(tsr.budget_psf_min), 2) AS avg_budget_psf_min,
      ROUND(AVG(tsr.budget_psf_max), 2) AS avg_budget_psf_max,
      ROUND(AVG(tsr.sqft_min), 0) AS avg_sqft_min,
      ROUND(AVG(tsr.sqft_max), 0) AS avg_sqft_max,
      STRING_AGG(DISTINCT tp.industry, ', ') AS top_industries
    FROM tenant_space_requirements tsr
    JOIN tenant_profiles tp ON tp.id = tsr.tenant_profile_id
    WHERE ${conditions.join(' AND ')}
    GROUP BY UNNEST(tsr.preferred_neighborhoods)
    ORDER BY demand_count DESC
    LIMIT 25
  `, params);

  res.json({ neighborhoods: result.rows });
});

// GET /api/analytics/industry-insights
router.get('/industry-insights', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query(`
    SELECT
      tp.industry,
      COUNT(*) AS tenant_count,
      ROUND(AVG(ts.desirability_index), 1) AS avg_desirability,
      ROUND(AVG(ts.expansion_likelihood_score), 1) AS avg_expansion_score,
      ROUND(AVG(tsr.budget_psf_max), 2) AS avg_budget_psf,
      ROUND(AVG(tp.number_of_locations), 1) AS avg_locations,
      MODE() WITHIN GROUP (ORDER BY tp.funding_status) AS top_funding_stage
    FROM tenant_profiles tp
    LEFT JOIN tenant_scores ts ON ts.tenant_profile_id = tp.id
    LEFT JOIN tenant_space_requirements tsr ON tsr.tenant_profile_id = tp.id
    WHERE tp.status = 'active'
    GROUP BY tp.industry
    ORDER BY tenant_count DESC
  `);

  res.json({ industries: result.rows });
});

// POST /api/analytics/refresh (admin trigger)
router.post('/refresh', authenticate, requireAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  await Promise.all([
    AnalyticsService.refreshDemandHeatmap(),
    AnalyticsService.takeSnapshot('daily'),
  ]);
  res.json({ message: 'Analytics refreshed' });
});

// GET /api/analytics/snapshots
router.get('/snapshots', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { type = 'daily', limit = '30' } = req.query as Record<string, string>;
  const result = await query(
    `SELECT snapshot_date, snapshot_type, metrics, computed_at
     FROM analytics_snapshots
     WHERE snapshot_type = $1
     ORDER BY snapshot_date DESC LIMIT $2`,
    [type, parseInt(limit, 10)]
  );
  res.json({ snapshots: result.rows });
});

export default router;
