import { query } from '../config/database';
import logger from '../utils/logger';

export class AnalyticsService {
  // Refresh demand heatmap aggregations
  static async refreshDemandHeatmap(): Promise<void> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const result = await query(`
      SELECT
        UNNEST(tsr.preferred_neighborhoods) AS neighborhood,
        'Manhattan' AS borough,  -- simplified; could join a neighborhoods table
        tp.space_use_type,
        tp.industry,
        COUNT(*) AS active_tenants,
        ROUND(AVG(tsr.budget_psf_min), 2) AS avg_budget_psf,
        ROUND(AVG((tsr.sqft_min + tsr.sqft_max) / 2), 0) AS avg_sqft_need,
        SUM(tsr.sqft_max) AS total_sqft_demand
      FROM tenant_space_requirements tsr
      JOIN tenant_profiles tp ON tp.id = tsr.tenant_profile_id
      WHERE tp.status = 'active'
      GROUP BY UNNEST(tsr.preferred_neighborhoods), tp.space_use_type, tp.industry
    `);

    for (const row of result.rows as Record<string, unknown>[]) {
      await query(
        `INSERT INTO demand_heatmap
           (neighborhood, borough, period_start, period_end, space_use_type, industry,
            active_tenants, avg_budget_psf, avg_sqft_need, total_sqft_demand, search_count)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0)
         ON CONFLICT DO NOTHING`,
        [
          row.neighborhood, row.borough, periodStart, periodEnd,
          row.space_use_type, row.industry,
          row.active_tenants, row.avg_budget_psf, row.avg_sqft_need, row.total_sqft_demand,
        ]
      );
    }

    logger.info('Demand heatmap refreshed');
  }

  // Daily analytics snapshot
  static async takeSnapshot(type: 'daily' | 'weekly' | 'monthly' = 'daily'): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    const [tenantStats, searchStats, neighborhoodDemand] = await Promise.all([
      query(`
        SELECT
          tp.industry,
          tp.space_use_type,
          COUNT(*) AS count,
          ROUND(AVG(ts.desirability_index), 1) AS avg_score,
          ROUND(AVG(tsr.budget_psf_max), 2) AS avg_budget_psf,
          ROUND(AVG(tsr.sqft_min), 0) AS avg_sqft_min
        FROM tenant_profiles tp
        LEFT JOIN tenant_scores ts ON ts.tenant_profile_id = tp.id
        LEFT JOIN tenant_space_requirements tsr ON tsr.tenant_profile_id = tp.id
        WHERE tp.status = 'active'
        GROUP BY tp.industry, tp.space_use_type
      `),
      query(`
        SELECT
          (properties->>'filters')::jsonb->>'industry' AS industry,
          COUNT(*) AS search_count
        FROM user_events
        WHERE event_type = 'search'
          AND created_at::date = CURRENT_DATE
        GROUP BY 1
      `),
      query(`
        SELECT
          UNNEST(tsr.preferred_neighborhoods) AS neighborhood,
          COUNT(*) AS demand
        FROM tenant_space_requirements tsr
        JOIN tenant_profiles tp ON tp.id = tsr.tenant_profile_id
        WHERE tp.status = 'active'
        GROUP BY 1 ORDER BY demand DESC LIMIT 15
      `),
    ]);

    await query(
      `INSERT INTO analytics_snapshots (snapshot_date, snapshot_type, dimensions, metrics)
       VALUES ($1, $2, $3::jsonb, $4::jsonb)`,
      [
        today, type,
        JSON.stringify({ date: today }),
        JSON.stringify({
          tenantStats: tenantStats.rows,
          searchStats: searchStats.rows,
          neighborhoodDemand: neighborhoodDemand.rows,
        }),
      ]
    );

    logger.info(`Analytics snapshot taken: ${type} for ${today}`);
  }

  // Get trend data for a metric
  static async getTrend(
    metric: 'tenants' | 'searches' | 'interests',
    days: number = 30
  ): Promise<Array<{ date: string; value: number }>> {
    let sql: string;

    if (metric === 'tenants') {
      sql = `
        SELECT DATE(created_at) AS date, COUNT(*) AS value
        FROM tenant_profiles
        WHERE created_at > NOW() - INTERVAL '${days} days'
        GROUP BY date ORDER BY date
      `;
    } else if (metric === 'searches') {
      sql = `
        SELECT DATE(created_at) AS date, COUNT(*) AS value
        FROM user_events WHERE event_type = 'search'
          AND created_at > NOW() - INTERVAL '${days} days'
        GROUP BY date ORDER BY date
      `;
    } else {
      sql = `
        SELECT DATE(created_at) AS date, COUNT(*) AS value
        FROM interest_expressions
        WHERE created_at > NOW() - INTERVAL '${days} days'
        GROUP BY date ORDER BY date
      `;
    }

    const result = await query<{ date: string; value: string }>(sql);
    return result.rows.map((r) => ({ date: r.date, value: parseInt(r.value, 10) }));
  }
}
