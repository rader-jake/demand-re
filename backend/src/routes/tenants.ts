import { Router, Response } from 'express';
import { body } from 'express-validator';
import { query } from '../config/database';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ScoringService } from '../services/scoring';

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

// GET /api/tenants/profile - Get most recent requirement
router.get('/profile', authenticate, requireTenant, async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query<Record<string, any>>(
    `SELECT tr.*, ts.financial_strength_score, ts.expansion_likelihood_score,
            ts.market_desirability_score, ts.desirability_index
     FROM tenant_requirements tr
     LEFT JOIN tenant_scores ts ON ts.tenant_profile_id = tr.id
     WHERE tr.user_id = $1
     ORDER BY tr.created_at DESC
     LIMIT 1`,
    [req.user!.userId]
  );

  const leadResult = await query(
    `SELECT * FROM meta_leads WHERE user_id = $1 ORDER BY created_time DESC LIMIT 1`,
    [req.user!.userId]
  );
  const metaLead = leadResult.rows.length > 0 ? leadResult.rows[0] : null;

  if (result.rows.length === 0) {
    res.json({ profile: null, metaLead });
    return;
  }

  // Map database fields to the snake_case / camelCase structure expected by the frontend
  const tr = result.rows[0];
  const profile = {
    profileId: tr.id,
    userId: tr.user_id,
    status: tr.status,
    legalName: tr.full_name,
    dbaName: tr.full_name,
    industry: tr.business_type,
    spaceUseType: tr.space_types ? tr.space_types[0] : 'office',
    numberOfLocations: tr.location_count !== null && tr.location_count !== undefined ? tr.location_count : 1,
    description: tr.ideal_space_description,
    profileCompleteness: 100,
    viewCount: 0,
    interestCount: 0,
    preferredNeighborhoods: tr.neighborhoods || [],
    sqftMin: tr.min_square_feet,
    sqftMax: tr.max_square_feet,
    budgetPsfMin: tr.min_monthly_budget ? Math.round((tr.min_monthly_budget * 12) / (tr.min_square_feet || 1000)) : null,
    budgetPsfMax: tr.max_monthly_budget ? Math.round((tr.max_monthly_budget * 12) / (tr.max_square_feet || 1000)) : null,
    budgetMonthlyMin: tr.min_monthly_budget,
    budgetMonthlyMax: tr.max_monthly_budget,
    targetMoveInDate: tr.target_move_start_date ? new Date(tr.target_move_start_date).toISOString().split('T')[0] : null,
    timelineNotes: tr.move_timeline_label,
    financialStrengthScore: tr.financial_strength_score,
    expansionLikelihoodScore: tr.expansion_likelihood_score,
    marketDesirabilityScore: tr.market_desirability_score,
    desirabilityIndex: tr.desirability_index ? Number(tr.desirability_index) : null,
    concept_description: tr.concept_description,
    other_business_type: tr.other_business_type,
    freshnessStatus: tr.freshness_status || 'Fresh',
    updatedAt: tr.updated_at
  };

  res.json({ profile, metaLead });
});

// GET /api/tenants/requirements - Get all requirements
router.get('/requirements', authenticate, requireTenant, async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query(
    `SELECT * FROM tenant_requirements WHERE user_id = $1 ORDER BY created_at DESC`,
    [req.user!.userId]
  );
  res.json({ requirements: result.rows });
});

// POST /api/tenants/profile - Create profile (step 1: business info)
router.post(
  '/profile',
  authenticate,
  requireTenant,
  [
    body('legalName').trim().notEmpty(),
    body('industry').trim().notEmpty(),
    body('spaceUseType').isIn(['retail', 'office', 'industrial', 'flex', 'medical', 'restaurant', 'mixed']),
    body('numberOfLocations').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const {
      legalName, dbaName, industry, numberOfLocations, description, spaceUseType,
    } = req.body;

    const finalName = dbaName || legalName;
    const mappedUse = mapSpaceUseType(spaceUseType);
    const spaceTypesJson = JSON.stringify([mappedUse]);

    const result = await query<{ id: string }>(
      `INSERT INTO tenant_requirements (
        user_id, source, full_name, email, business_type, operating_status,
        location_count, boroughs, neighborhoods, location_flexibility, space_types,
        ideal_space_description, status, freshness_status
      ) VALUES ($1, 'web', $2, $3, $4, 'Currently Operating', $5, '[]'::jsonb, '[]'::jsonb, 'flexible', $6, $7, 'New', 'Fresh')
      RETURNING id`,
      [
        req.user!.userId,
        finalName,
        req.user!.email,
        industry,
        numberOfLocations ?? 1,
        spaceTypesJson,
        description ?? null
      ]
    );

    const profileId = result.rows[0].id;
    await ScoringService.computeAndSave(profileId);

    res.status(201).json({ profileId, id: profileId });
  }
);

// PUT /api/tenants/profile - Update requirement info
router.put('/profile', authenticate, requireTenant,
  [body('legalName').optional().trim().notEmpty()],
  validate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const existing = await query('SELECT id FROM tenant_requirements WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [req.user!.userId]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Requirement not found' });
      return;
    }
    const reqId = existing.rows[0].id;

    const {
      legalName, dbaName, industry, numberOfLocations, description, spaceUseType,
    } = req.body;

    const finalName = legalName || dbaName;
    const spaceTypesJson = spaceUseType ? JSON.stringify([mapSpaceUseType(spaceUseType)]) : null;

    await query(
      `UPDATE tenant_requirements SET
        full_name = COALESCE($1, full_name),
        business_type = COALESCE($2, business_type),
        location_count = COALESCE($3, location_count),
        ideal_space_description = COALESCE($4, ideal_space_description),
        space_types = COALESCE($5, space_types),
        updated_at = NOW()
       WHERE id = $6`,
      [
        finalName,
        industry,
        numberOfLocations,
        description,
        spaceTypesJson,
        reqId
      ]
    );

    await ScoringService.computeAndSave(reqId as string);
    await updateRequirementCompleteness(reqId as string);

    res.json({ message: 'Profile updated' });
  }
);

// PUT /api/tenants/profile/space-requirements
router.put('/profile/space-requirements', authenticate, requireTenant, async (req: AuthRequest, res: Response): Promise<void> => {
  const existing = await query('SELECT id FROM tenant_requirements WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [req.user!.userId]);
  if (existing.rows.length === 0) {
    res.status(404).json({ error: 'Requirement not found' });
    return;
  }
  const reqId = existing.rows[0].id;

  const {
    preferredNeighborhoods, sqftMin, sqftMax,
    budgetMonthlyMin, budgetMonthlyMax, targetMoveInDate,
    timelineNotes,
  } = req.body;

  const boroughs: string[] = [];
  if (preferredNeighborhoods && Array.isArray(preferredNeighborhoods)) {
    preferredNeighborhoods.forEach((n: string) => {
      const lower = n.toLowerCase();
      if (lower.includes('brooklyn') && !boroughs.includes('Brooklyn')) boroughs.push('Brooklyn');
      if (lower.includes('manhattan') && !boroughs.includes('Manhattan')) boroughs.push('Manhattan');
      if (lower.includes('queens') && !boroughs.includes('Queens')) boroughs.push('Queens');
      if (lower.includes('bronx') && !boroughs.includes('Bronx')) boroughs.push('Bronx');
      if (lower.includes('staten') && !boroughs.includes('Staten Island')) boroughs.push('Staten Island');
    });
  }

  await query(
    `UPDATE tenant_requirements SET
      boroughs = $1,
      neighborhoods = $2,
      min_square_feet = $3,
      max_square_feet = $4,
      ideal_square_feet = $5,
      min_monthly_budget = $6,
      max_monthly_budget = $7,
      target_move_start_date = $8,
      move_timeline_label = $9,
      updated_at = NOW()
     WHERE id = $10`,
    [
      JSON.stringify(boroughs),
      preferredNeighborhoods ? JSON.stringify(preferredNeighborhoods) : null,
      sqftMin ?? null,
      sqftMax ?? null,
      sqftMax ?? null,
      budgetMonthlyMin ?? null,
      budgetMonthlyMax ?? null,
      targetMoveInDate ?? null,
      timelineNotes ?? null,
      reqId
    ]
  );

  await ScoringService.computeAndSave(reqId as string);
  await updateRequirementCompleteness(reqId as string);

  res.json({ message: 'Space requirements saved' });
});

// PUT /api/tenants/profile/status
router.put('/profile/status', authenticate, requireTenant, async (req: AuthRequest, res: Response): Promise<void> => {
  const { status } = req.body;
  if (!['New', 'Reviewing', 'Matching', 'Matches Sent', 'Touring', 'Negotiating', 'Closed Won', 'Closed Lost', 'Dormant', 'Needs Refresh'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }
  await query(
    `UPDATE tenant_requirements SET status = $1, updated_at = NOW() WHERE user_id = $2`,
    [status, req.user!.userId]
  );
  res.json({ message: 'Status updated' });
});

// GET /api/tenants/interests - Incoming interest from landlords
router.get('/interests', authenticate, requireTenant, async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query(
    `SELECT ie.*, u.first_name, u.last_name, u.email, lp.company_name
     FROM interest_expressions ie
     JOIN tenant_requirements tr ON tr.id = ie.tenant_profile_id
     JOIN users u ON u.id = ie.landlord_id
     LEFT JOIN landlord_profiles lp ON lp.user_id = ie.landlord_id
     WHERE tr.user_id = $1
     ORDER BY ie.created_at DESC`,
    [req.user!.userId]
  );
  res.json({ interests: result.rows });
});

// PUT /api/tenants/interests/:id/respond
router.put('/interests/:id/respond', authenticate, requireTenant, async (req: AuthRequest, res: Response): Promise<void> => {
  const { status } = req.body;
  if (!['accepted', 'declined'].includes(status)) {
    res.status(400).json({ error: 'Status must be accepted or declined' });
    return;
  }

  await query(
    `UPDATE interest_expressions SET status = $1, responded_at = NOW()
     WHERE id = $2`,
    [status, req.params.id]
  );
  res.json({ message: 'Response recorded' });
});

async function updateRequirementCompleteness(reqId: string): Promise<void> {
  const result = await query<Record<string, any>>(
    `SELECT * FROM tenant_requirements WHERE id = $1`,
    [reqId]
  );

  if (result.rows.length === 0) return;
  const r = result.rows[0];

  const checks: Record<string, any> = {
    full_name: r.full_name,
    business_type: r.business_type,
    operating_status: r.operating_status,
    boroughs: r.boroughs,
    neighborhoods: r.neighborhoods,
    space_types: r.space_types,
    min_square_feet: r.min_square_feet,
    max_square_feet: r.max_square_feet,
    min_monthly_budget: r.min_monthly_budget,
    max_monthly_budget: r.max_monthly_budget,
    move_timeline_label: r.move_timeline_label,
    ideal_space_description: r.ideal_space_description
  };

  let filledCount = 0;
  let totalKeys = Object.keys(checks).length;
  for (const val of Object.values(checks)) {
    if (val !== null && val !== undefined && val !== '' &&
      !(Array.isArray(val) && val.length === 0) &&
      !(typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0)) {
      filledCount++;
    }
  }

  const score = Math.min(100, Math.round((filledCount / totalKeys) * 100));

  await query(
    'UPDATE tenant_requirements SET status = CASE WHEN status = \'New\' AND $1 >= 60 THEN \'Reviewing\' ELSE status END WHERE id = $2',
    [score, reqId]
  );
}

export default router;
