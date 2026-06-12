import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth';
import { ScoringService } from '../services/scoring';
import { STANDARD_BUSINESS_TYPES, APPROVED_OPERATING_STATUSES } from '../utils/normalize';

const router = Router();

function calculateFreshness(lastConfirmedAt: Date): string {
  const diffTime = Math.abs(new Date().getTime() - lastConfirmedAt.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays <= 30) return 'Fresh';
  if (diffDays <= 90) return 'Warm';
  if (diffDays <= 180) return 'Aging';
  return 'Stale';
}

function calculateMoveDates(timeline: string): { start: Date | null; end: Date | null } {
  const today = new Date();
  const normalized = timeline.replace(/–/g, '-').trim().toLowerCase();

  if (normalized.includes('immediat')) {
    const start = new Date(today);
    const end = new Date(today);
    end.setDate(end.getDate() + 30);
    return { start, end };
  } else if (normalized.includes('1-3') || normalized.includes('1 to 3')) {
    const start = new Date(today);
    start.setMonth(start.getMonth() + 1);
    const end = new Date(today);
    end.setMonth(end.getMonth() + 3);
    return { start, end };
  } else if (normalized.includes('3-6') || normalized.includes('3 to 6')) {
    const start = new Date(today);
    start.setMonth(start.getMonth() + 3);
    const end = new Date(today);
    end.setMonth(end.getMonth() + 6);
    return { start, end };
  } else if (normalized.includes('6-12') || normalized.includes('6 to 12')) {
    const start = new Date(today);
    start.setMonth(start.getMonth() + 6);
    const end = new Date(today);
    end.setMonth(end.getMonth() + 12);
    return { start, end };
  } else if (normalized.includes('12+') || normalized.includes('12 months')) {
    const start = new Date(today);
    start.setMonth(start.getMonth() + 12);
    return { start, end: null };
  } else {
    return { start: null, end: null };
  }
}

// GET /api/me/requirement
router.get('/requirement', authenticate, requireTenant, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT tr.*, ts.financial_strength_score, ts.expansion_likelihood_score,
              ts.market_desirability_score, ts.desirability_index
       FROM tenant_requirements tr
       LEFT JOIN tenant_scores ts ON ts.tenant_profile_id = tr.id
       WHERE tr.user_id = $1
       ORDER BY tr.created_at DESC
       LIMIT 1`,
      [req.user!.userId]
    );

    if (result.rows.length === 0) {
      res.json({ requirement: null });
      return;
    }

    res.json({ requirement: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/me/requirement
router.patch('/requirement', authenticate, requireTenant, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const existing = await query(
      `SELECT id, status FROM tenant_requirements
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.user!.userId]
    );

    const fields = req.body;

    const allowedFields = [
      'business_type',
      'operating_status',
      'location_count',
      'boroughs',
      'neighborhoods',
      'location_flexibility',
      'space_types',
      'min_square_feet',
      'max_square_feet',
      'ideal_square_feet',
      'min_monthly_budget',
      'max_monthly_budget',
      'budget_flexibility',
      'move_timeline_label',
      'ideal_space_description',
      'contact_permission',
      'budget_range_label',
      'square_feet_range_label',
      'concept_description',
      'other_business_type'
    ];

    if (fields.business_type !== undefined && !STANDARD_BUSINESS_TYPES.includes(fields.business_type)) {
      res.status(400).json({ error: `Invalid business type. Must be one of: ${STANDARD_BUSINESS_TYPES.join(', ')}` });
      return;
    }

    if (fields.operating_status !== undefined && !APPROVED_OPERATING_STATUSES.includes(fields.operating_status)) {
      res.status(400).json({ error: `Invalid operating status. Must be one of: ${APPROVED_OPERATING_STATUSES.join(', ')}` });
      return;
    }

    if (existing.rows.length === 0) {
      // Create new requirement
      const userRes = await query(
        `SELECT email, first_name, last_name, phone FROM users WHERE id = $1`,
        [req.user!.userId]
      );
      const user = userRes.rows[0] || {};
      const full_name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Anonymous';
      const email = user.email || '';
      const phone = user.phone || null;

      const keys = Object.keys(fields).filter(key => allowedFields.includes(key));
      const lastConfirmedAt = new Date();
      const freshnessStatus = 'Fresh';
      const status = 'New';

      const insertKeys = [
        'user_id',
        'source',
        'full_name',
        'email',
        'phone',
        'status',
        'freshness_status',
        'last_confirmed_at'
      ];
      const insertValues: any[] = [
        req.user!.userId,
        'web',
        full_name,
        email,
        phone,
        status,
        freshnessStatus,
        lastConfirmedAt
      ];

      // Handle timeline changes
      let startMove: Date | null = null;
      let endMove: Date | null = null;
      if (keys.includes('move_timeline_label')) {
        const timelineVal = fields['move_timeline_label'];
        const { start, end } = calculateMoveDates(timelineVal);
        startMove = start;
        endMove = end;
      }
      insertKeys.push('target_move_start_date', 'target_move_end_date');
      insertValues.push(startMove, endMove);

      keys.forEach(key => {
        let val = fields[key];
        if (['boroughs', 'neighborhoods', 'space_types'].includes(key)) {
          val = typeof val === 'string' ? val : JSON.stringify(val);
        }
        insertKeys.push(`"${key}"`);
        insertValues.push(val);
      });

      const placeholders = insertValues.map((_, i) => `$${i + 1}`).join(', ');
      const insertQuery = `
        INSERT INTO tenant_requirements (${insertKeys.join(', ')})
        VALUES (${placeholders})
        RETURNING *
      `;

      const result = await query(insertQuery, insertValues);
      const newReq = result.rows[0] as any;

      // Recalculate match score
      await ScoringService.computeAndSave(newReq.id as string);

      res.json({ requirement: newReq });
      return;
    }

    const currentReq = existing.rows[0] as { id: string; status: string };
    const keys = Object.keys(fields).filter(key => allowedFields.includes(key));

    // Automatically set timing and dates
    const lastConfirmedAt = new Date();
    const freshnessStatus = 'Fresh'; // Recalculated on update to now

    // Determine status logic
    let newStatus = currentReq.status;
    if (['Dormant', 'Needs Refresh'].includes(currentReq.status)) {
      newStatus = 'Reviewing';
    }

    const sets = [
      `updated_at = NOW()`,
      `last_confirmed_at = $2`,
      `freshness_status = $3`,
      `status = $4`
    ];
    const values: any[] = [currentReq.id, lastConfirmedAt, freshnessStatus, newStatus];
    let idx = 5;

    // Handle timeline changes
    if (keys.includes('move_timeline_label')) {
      const timelineVal = fields['move_timeline_label'];
      const { start, end } = calculateMoveDates(timelineVal);
      sets.push(`target_move_start_date = $${idx++}`);
      values.push(start);
      sets.push(`target_move_end_date = $${idx++}`);
      values.push(end);
    }

    // Add remaining parameters
    keys.forEach(key => {
      let val = fields[key];
      if (['boroughs', 'neighborhoods', 'space_types'].includes(key)) {
        val = typeof val === 'string' ? val : JSON.stringify(val);
      }
      sets.push(`"${key}" = $${idx++}`);
      values.push(val);
    });

    const updateQuery = `
      UPDATE tenant_requirements
      SET ${sets.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    const result = await query(updateQuery, values);

    // Recalculate match score
    await ScoringService.computeAndSave(currentReq.id);

    res.json({ requirement: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/me/requirement/confirm
router.post('/requirement/confirm', authenticate, requireTenant, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const existing = await query(
      `SELECT id FROM tenant_requirements
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.user!.userId]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'You do not have a saved space requirement yet. Submit your space needs to start matching with landlords and property owners.' });
      return;
    }

    const reqId = (existing.rows[0] as { id: string }).id;

    const result = await query(
      `UPDATE tenant_requirements
       SET last_confirmed_at = NOW(), freshness_status = 'Fresh', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [reqId]
    );

    res.json({ requirement: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
