import { Router, Response } from 'express';
import { body } from 'express-validator';
import { query } from '../config/database';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ScoringService } from '../services/scoring';

const router = Router();

// GET /api/tenants/profile - Get own profile
router.get('/profile', authenticate, requireTenant, async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query<Record<string, unknown>>(
    `SELECT tp.*, tsr.*, ts.financial_strength_score, ts.expansion_likelihood_score,
            ts.market_desirability_score, ts.desirability_index
     FROM tenant_profiles tp
     LEFT JOIN tenant_space_requirements tsr ON tsr.tenant_profile_id = tp.id
     LEFT JOIN tenant_scores ts ON ts.tenant_profile_id = tp.id
     WHERE tp.user_id = $1`,
    [req.user!.userId]
  );

  if (result.rows.length === 0) {
    res.json({ profile: null });
    return;
  }

  res.json({ profile: result.rows[0] });
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
    body('numberOfLocations').optional().isInt({ min: 1 }),
    body('yearsInOperation').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const existing = await query('SELECT id FROM tenant_profiles WHERE user_id = $1', [req.user!.userId]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Profile already exists. Use PUT to update.' });
      return;
    }

    const {
      legalName, dbaName, industry, subIndustry, yearsInOperation,
      numberOfLocations, website, description, ownershipStructure, spaceUseType,
    } = req.body;

    const result = await query<{ id: string }>(
      `INSERT INTO tenant_profiles
        (user_id, legal_name, dba_name, industry, sub_industry, years_in_operation,
         number_of_locations, website, description, ownership_structure, space_use_type, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'draft')
       RETURNING id`,
      [req.user!.userId, legalName, dbaName ?? null, industry, subIndustry ?? null,
       yearsInOperation ?? null, numberOfLocations ?? 1, website ?? null,
       description ?? null, ownershipStructure ?? null, spaceUseType]
    );

    const profileId = result.rows[0].id;
    await ScoringService.computeAndSave(profileId);

    res.status(201).json({ profileId });
  }
);

// PUT /api/tenants/profile - Update business info
router.put('/profile', authenticate, requireTenant,
  [body('legalName').optional().trim().notEmpty()],
  validate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const profileResult = await query<{ id: string }>(
      'SELECT id FROM tenant_profiles WHERE user_id = $1', [req.user!.userId]
    );
    if (profileResult.rows.length === 0) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    const profileId = profileResult.rows[0].id;
    const {
      legalName, dbaName, industry, subIndustry, yearsInOperation, numberOfLocations,
      website, description, ownershipStructure, spaceUseType,
      revenueRange, creditScoreRange, fundingStatus, hasGuarantor, guarantorDetails,
      revenueVisible, creditVisible, financialsUnlockable,
    } = req.body;

    await query(
      `UPDATE tenant_profiles SET
        legal_name          = COALESCE($1, legal_name),
        dba_name            = COALESCE($2, dba_name),
        industry            = COALESCE($3, industry),
        sub_industry        = COALESCE($4, sub_industry),
        years_in_operation  = COALESCE($5, years_in_operation),
        number_of_locations = COALESCE($6, number_of_locations),
        website             = COALESCE($7, website),
        description         = COALESCE($8, description),
        ownership_structure = COALESCE($9, ownership_structure),
        space_use_type      = COALESCE($10, space_use_type),
        revenue_range       = COALESCE($11, revenue_range),
        credit_score_range  = COALESCE($12, credit_score_range),
        funding_status      = COALESCE($13, funding_status),
        has_guarantor       = COALESCE($14, has_guarantor),
        guarantor_details   = COALESCE($15, guarantor_details),
        revenue_visible     = COALESCE($16, revenue_visible),
        credit_visible      = COALESCE($17, credit_visible),
        financials_unlockable = COALESCE($18, financials_unlockable)
       WHERE id = $19`,
      [
        legalName, dbaName, industry, subIndustry, yearsInOperation, numberOfLocations,
        website, description, ownershipStructure, spaceUseType,
        revenueRange, creditScoreRange, fundingStatus, hasGuarantor, guarantorDetails,
        revenueVisible, creditVisible, financialsUnlockable,
        profileId,
      ]
    );

    await ScoringService.computeAndSave(profileId);
    res.json({ message: 'Profile updated' });
  }
);

// PUT /api/tenants/profile/space-requirements
router.put('/profile/space-requirements', authenticate, requireTenant, async (req: AuthRequest, res: Response): Promise<void> => {
  const profileResult = await query<{ id: string }>(
    'SELECT id FROM tenant_profiles WHERE user_id = $1', [req.user!.userId]
  );
  if (profileResult.rows.length === 0) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }
  const profileId = profileResult.rows[0].id;

  const {
    preferredNeighborhoods, flexibleOnLocation, sqftMin, sqftMax,
    budgetPsfMin, budgetPsfMax, budgetMonthlyMin, budgetMonthlyMax,
    leaseTermPreference, leaseTermYearsMin, leaseTermYearsMax, targetMoveInDate,
    timelineNotes, requiresVenting, requiresFrontage, requiresElevator,
    requiresParking, requiresLoadingDock, requiresOutdoorSpace, requires24hrAccess,
    additionalAmenities, expectedFootTraffic, buildoutNeeds, usesHeavyEquipment, otherRequirements,
  } = req.body;

  await query(
    `INSERT INTO tenant_space_requirements (tenant_profile_id, preferred_neighborhoods,
       flexible_on_location, sqft_min, sqft_max, budget_psf_min, budget_psf_max,
       budget_monthly_min, budget_monthly_max, lease_term_preference, lease_term_years_min,
       lease_term_years_max, target_move_in_date, timeline_notes, requires_venting,
       requires_frontage, requires_elevator, requires_parking, requires_loading_dock,
       requires_outdoor_space, requires_24hr_access, additional_amenities,
       expected_foot_traffic, buildout_needs, uses_heavy_equipment, other_requirements)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
     ON CONFLICT (tenant_profile_id) DO UPDATE SET
       preferred_neighborhoods = EXCLUDED.preferred_neighborhoods,
       flexible_on_location    = EXCLUDED.flexible_on_location,
       sqft_min                = EXCLUDED.sqft_min,
       sqft_max                = EXCLUDED.sqft_max,
       budget_psf_min          = EXCLUDED.budget_psf_min,
       budget_psf_max          = EXCLUDED.budget_psf_max,
       budget_monthly_min      = EXCLUDED.budget_monthly_min,
       budget_monthly_max      = EXCLUDED.budget_monthly_max,
       lease_term_preference   = EXCLUDED.lease_term_preference,
       lease_term_years_min    = EXCLUDED.lease_term_years_min,
       lease_term_years_max    = EXCLUDED.lease_term_years_max,
       target_move_in_date     = EXCLUDED.target_move_in_date,
       timeline_notes          = EXCLUDED.timeline_notes,
       requires_venting        = EXCLUDED.requires_venting,
       requires_frontage       = EXCLUDED.requires_frontage,
       requires_elevator       = EXCLUDED.requires_elevator,
       requires_parking        = EXCLUDED.requires_parking,
       requires_loading_dock   = EXCLUDED.requires_loading_dock,
       requires_outdoor_space  = EXCLUDED.requires_outdoor_space,
       requires_24hr_access    = EXCLUDED.requires_24hr_access,
       additional_amenities    = EXCLUDED.additional_amenities,
       expected_foot_traffic   = EXCLUDED.expected_foot_traffic,
       buildout_needs          = EXCLUDED.buildout_needs,
       uses_heavy_equipment    = EXCLUDED.uses_heavy_equipment,
       other_requirements      = EXCLUDED.other_requirements`,
    [
      profileId, preferredNeighborhoods ?? [], flexibleOnLocation ?? false,
      sqftMin ?? null, sqftMax ?? null, budgetPsfMin ?? null, budgetPsfMax ?? null,
      budgetMonthlyMin ?? null, budgetMonthlyMax ?? null, leaseTermPreference ?? null,
      leaseTermYearsMin ?? null, leaseTermYearsMax ?? null, targetMoveInDate ?? null,
      timelineNotes ?? null, requiresVenting ?? false, requiresFrontage ?? false,
      requiresElevator ?? false, requiresParking ?? false, requiresLoadingDock ?? false,
      requiresOutdoorSpace ?? false, requires24hrAccess ?? false, additionalAmenities ?? [],
      expectedFootTraffic ?? null, buildoutNeeds ?? null, usesHeavyEquipment ?? false,
      otherRequirements ?? null,
    ]
  );

  // Update completeness and activate if complete
  await updateProfileCompleteness(profileId);
  res.json({ message: 'Space requirements saved' });
});

// PUT /api/tenants/profile/status
router.put('/profile/status', authenticate, requireTenant, async (req: AuthRequest, res: Response): Promise<void> => {
  const { status } = req.body;
  if (!['active', 'paused', 'archived'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }
  await query(
    `UPDATE tenant_profiles SET status = $1 WHERE user_id = $2`,
    [status, req.user!.userId]
  );
  res.json({ message: 'Status updated' });
});

// GET /api/tenants/interests - Incoming interest from landlords
router.get('/interests', authenticate, requireTenant, async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query(
    `SELECT ie.*, u.first_name, u.last_name, u.email, lp.company_name
     FROM interest_expressions ie
     JOIN tenant_profiles tp ON tp.id = ie.tenant_profile_id
     JOIN users u ON u.id = ie.landlord_id
     LEFT JOIN landlord_profiles lp ON lp.user_id = ie.landlord_id
     WHERE tp.user_id = $1
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

  const profileResult = await query<{ id: string }>(
    'SELECT id FROM tenant_profiles WHERE user_id = $1', [req.user!.userId]
  );
  if (profileResult.rows.length === 0) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  await query(
    `UPDATE interest_expressions SET status = $1, responded_at = NOW()
     WHERE id = $2 AND tenant_profile_id = $3`,
    [status, req.params.id, profileResult.rows[0].id]
  );
  res.json({ message: 'Response recorded' });
});

async function updateProfileCompleteness(profileId: string): Promise<void> {
  const result = await query<Record<string, unknown>>(
    `SELECT tp.*, tsr.preferred_neighborhoods, tsr.sqft_min, tsr.budget_psf_min
     FROM tenant_profiles tp
     LEFT JOIN tenant_space_requirements tsr ON tsr.tenant_profile_id = tp.id
     WHERE tp.id = $1`,
    [profileId]
  );

  if (result.rows.length === 0) return;
  const p = result.rows[0];

  let score = 0;
  const checks: Record<string, unknown> = {
    legal_name: p.legal_name, industry: p.industry, description: p.description,
    years_in_operation: p.years_in_operation, website: p.website,
    revenue_range: p.revenue_range, credit_score_range: p.credit_score_range,
    funding_status: p.funding_status, preferred_neighborhoods: p.preferred_neighborhoods,
    sqft_min: p.sqft_min, budget_psf_min: p.budget_psf_min,
  };

  for (const val of Object.values(checks)) {
    if (val !== null && val !== undefined && val !== '' &&
        !(Array.isArray(val) && (val as unknown[]).length === 0)) {
      score += 9;
    }
  }

  score = Math.min(100, score);

  const newStatus = score >= 60 ? 'active' : 'draft';
  await query(
    'UPDATE tenant_profiles SET profile_completeness = $1, status = $2 WHERE id = $3',
    [score, newStatus, profileId]
  );
}

export default router;
