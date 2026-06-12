import { Router, Request, Response } from 'express';
import { query } from '../config/database';

const router = Router();

// GET /api/stats
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const [
      activeRes,
      freshRes,
      boroughRes,
      businessRes,
      spaceRes,
      budgetRes,
      timelineRes
    ] = await Promise.all([
      // active_requirements
      query('SELECT COUNT(*) AS count FROM tenant_requirements WHERE status NOT IN (\'Closed Won\', \'Closed Lost\', \'Dormant\')'),
      
      // fresh_requirements
      query('SELECT COUNT(*) AS count FROM tenant_requirements WHERE created_at > NOW() - INTERVAL \'30 days\' AND status NOT IN (\'Closed Won\', \'Closed Lost\', \'Dormant\')'),
      
      // requirements_by_borough
      query(`
        SELECT b.val AS borough, COUNT(*)::integer AS count
        FROM tenant_requirements, jsonb_array_elements_text(COALESCE(boroughs, '[]'::jsonb)) AS b(val)
        WHERE status NOT IN ('Closed Won', 'Closed Lost', 'Dormant')
        GROUP BY b.val
        ORDER BY count DESC
      `),

      // requirements_by_business_type
      query(`
        SELECT business_type, COUNT(*)::integer AS count
        FROM tenant_requirements
        WHERE status NOT IN ('Closed Won', 'Closed Lost', 'Dormant') AND business_type IS NOT NULL
        GROUP BY business_type
        ORDER BY count DESC
      `),

      // requirements_by_space_type
      query(`
        SELECT s.val AS space_type, COUNT(*)::integer AS count
        FROM tenant_requirements, jsonb_array_elements_text(COALESCE(space_types, '[]'::jsonb)) AS s(val)
        WHERE status NOT IN ('Closed Won', 'Closed Lost', 'Dormant')
        GROUP BY s.val
        ORDER BY count DESC
      `),

      // requirements_by_budget
      query(`
        SELECT
          CASE
            WHEN max_monthly_budget < 5000 THEN 'Under $5K'
            WHEN max_monthly_budget >= 5000 AND max_monthly_budget < 10000 THEN '$5K-$10K'
            WHEN max_monthly_budget >= 10000 AND max_monthly_budget < 25000 THEN '$10K-$25K'
            WHEN max_monthly_budget >= 25000 THEN '$25K+'
            ELSE 'Flexible'
          END AS range,
          COUNT(*)::integer AS count
        FROM tenant_requirements
        WHERE status NOT IN ('Closed Won', 'Closed Lost', 'Dormant')
        GROUP BY range
        ORDER BY count DESC
      `),

      // requirements_by_timeline
      query(`
        SELECT move_timeline_label AS timeline, COUNT(*)::integer AS count
        FROM tenant_requirements
        WHERE status NOT IN ('Closed Won', 'Closed Lost', 'Dormant') AND move_timeline_label IS NOT NULL
        GROUP BY move_timeline_label
        ORDER BY count DESC
      `)
    ]);

    const active_requirements = parseInt((activeRes.rows[0] as { count: string }).count, 10);
    const fresh_requirements = parseInt((freshRes.rows[0] as { count: string }).count, 10);

    res.json({
      active_requirements,
      fresh_requirements,
      requirements_by_borough: boroughRes.rows,
      requirements_by_business_type: businessRes.rows,
      requirements_by_space_type: spaceRes.rows,
      requirements_by_budget: budgetRes.rows,
      requirements_by_timeline: timelineRes.rows
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
