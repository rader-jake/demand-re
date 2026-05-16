import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, requireLandlord, requireSubscription, AuthRequest } from '../middleware/auth';
import { trackEvent } from '../middleware/eventTracker';

const router = Router();

// GET /api/landlords/profile
router.get('/profile', authenticate, requireLandlord, async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query(
    'SELECT * FROM landlord_profiles WHERE user_id = $1', [req.user!.userId]
  );
  res.json({ profile: result.rows[0] ?? null });
});

// PUT /api/landlords/profile
router.put('/profile', authenticate, requireLandlord, async (req: AuthRequest, res: Response): Promise<void> => {
  const { companyName, companyType, bio, licenseNumber, website, boroughs } = req.body;

  await query(
    `INSERT INTO landlord_profiles (user_id, company_name, company_type, bio, license_number, website, boroughs)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (user_id) DO UPDATE SET
       company_name   = EXCLUDED.company_name,
       company_type   = EXCLUDED.company_type,
       bio            = EXCLUDED.bio,
       license_number = EXCLUDED.license_number,
       website        = EXCLUDED.website,
       boroughs       = EXCLUDED.boroughs`,
    [req.user!.userId, companyName ?? null, companyType ?? null, bio ?? null,
     licenseNumber ?? null, website ?? null, boroughs ?? []]
  );

  res.json({ message: 'Landlord profile saved' });
});

// GET /api/landlords/search - Search/filter tenants
router.get(
  '/search',
  authenticate,
  requireLandlord,
  trackEvent({
    eventType: 'search',
    entityType: 'tenant_search',
    getProperties: (req) => ({ filters: req.query }),
  }),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const {
      industry, spaceUseType, neighborhoodContains,
      budgetPsfMax, budgetPsfMin, sqftMin, sqftMax,
      revenueRange, creditRange, fundingStatus,
      minDesirabilityScore, minLocations, requiresVenting, requiresFrontage,
      page = '1', limit = '20',
    } = req.query as Record<string, string>;

    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    let p = 1;

    if (industry) {
      conditions.push(`tsv.industry ILIKE $${p++}`);
      params.push(`%${industry}%`);
    }
    if (spaceUseType) {
      conditions.push(`tsv.space_use_type = $${p++}`);
      params.push(spaceUseType);
    }
    if (neighborhoodContains) {
      conditions.push(`tsv.preferred_neighborhoods && $${p++}`);
      params.push([neighborhoodContains]);
    }
    if (budgetPsfMin) {
      conditions.push(`tsv.budget_psf_max >= $${p++}`);
      params.push(Number(budgetPsfMin));
    }
    if (budgetPsfMax) {
      conditions.push(`tsv.budget_psf_min <= $${p++}`);
      params.push(Number(budgetPsfMax));
    }
    if (sqftMin) {
      conditions.push(`tsv.sqft_max >= $${p++}`);
      params.push(Number(sqftMin));
    }
    if (sqftMax) {
      conditions.push(`tsv.sqft_min <= $${p++}`);
      params.push(Number(sqftMax));
    }
    if (revenueRange) {
      conditions.push(`tsv.revenue_range = $${p++}`);
      params.push(revenueRange);
    }
    if (creditRange) {
      conditions.push(`tsv.credit_score_range = $${p++}`);
      params.push(creditRange);
    }
    if (fundingStatus) {
      conditions.push(`tsv.funding_status = $${p++}`);
      params.push(fundingStatus);
    }
    if (minDesirabilityScore) {
      conditions.push(`tsv.desirability_index >= $${p++}`);
      params.push(Number(minDesirabilityScore));
    }
    if (minLocations) {
      conditions.push(`tsv.number_of_locations >= $${p++}`);
      params.push(Number(minLocations));
    }
    if (requiresVenting === 'true') {
      conditions.push(`tsv.requires_venting = TRUE`);
    }
    if (requiresFrontage === 'true') {
      conditions.push(`tsv.requires_frontage = TRUE`);
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    const where = conditions.join(' AND ');

    const [dataResult, countResult] = await Promise.all([
      query(
        `SELECT tsv.profile_id, tsv.user_id, tsv.legal_name, tsv.dba_name, tsv.industry,
                tsv.sub_industry, tsv.space_use_type, tsv.years_in_operation,
                tsv.number_of_locations, tsv.description, tsv.ownership_structure,
                tsv.funding_status,
                CASE WHEN tsv.revenue_visible THEN tsv.revenue_range ELSE NULL END AS revenue_range,
                CASE WHEN tsv.credit_visible THEN tsv.credit_score_range ELSE NULL END AS credit_score_range,
                tsv.financials_unlockable, tsv.profile_completeness,
                tsv.preferred_neighborhoods, tsv.sqft_min, tsv.sqft_max,
                tsv.budget_psf_min, tsv.budget_psf_max, tsv.lease_term_preference,
                tsv.target_move_in_date, tsv.requires_venting, tsv.requires_frontage,
                tsv.requires_elevator, tsv.requires_parking,
                tsv.financial_strength_score, tsv.expansion_likelihood_score,
                tsv.market_desirability_score, tsv.desirability_index,
                tsv.first_name, tsv.last_name, tsv.avatar_url,
                EXISTS(SELECT 1 FROM saved_tenants st WHERE st.landlord_id = $${p} AND st.tenant_profile_id = tsv.profile_id) AS is_saved,
                EXISTS(SELECT 1 FROM interest_expressions ie WHERE ie.landlord_id = $${p} AND ie.tenant_profile_id = tsv.profile_id) AS has_expressed_interest
         FROM tenant_search_view tsv
         WHERE ${where}
         ORDER BY tsv.desirability_index DESC NULLS LAST
         LIMIT $${p + 1} OFFSET $${p + 2}`,
        [...params, req.user!.userId, limitNum, offset]
      ),
      query(
        `SELECT COUNT(*) AS total FROM tenant_search_view tsv WHERE ${where}`,
        params
      ),
    ]);

    const total = parseInt((countResult.rows[0] as { total: string }).total, 10);

    res.json({
      tenants: dataResult.rows,
      pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  }
);

// GET /api/landlords/tenants/:profileId - View a specific tenant profile
router.get(
  '/tenants/:profileId',
  authenticate,
  requireLandlord,
  trackEvent({
    eventType: 'profile_view',
    entityType: 'tenant_profile',
    getEntityId: (req) => req.params.profileId,
    getProperties: (req) => ({ source: req.query.source ?? 'direct' }),
  }),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { profileId } = req.params;

    // Increment view count
    await query('UPDATE tenant_profiles SET view_count = view_count + 1 WHERE id = $1', [profileId]);

    const result = await query(
      `SELECT tsv.*,
              EXISTS(SELECT 1 FROM saved_tenants st WHERE st.landlord_id = $2 AND st.tenant_profile_id = tsv.profile_id) AS is_saved
       FROM tenant_search_view tsv
       WHERE tsv.profile_id = $1`,
      [profileId, req.user!.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Tenant profile not found' });
      return;
    }

    res.json({ tenant: result.rows[0] });
  }
);

// POST /api/landlords/interest/:profileId - Express interest
router.post('/interest/:profileId', authenticate, requireLandlord, requireSubscription, async (req: AuthRequest, res: Response): Promise<void> => {
  const { message } = req.body;
  const { profileId } = req.params;

  const profileCheck = await query<{ id: string }>(
    'SELECT id FROM tenant_profiles WHERE id = $1 AND status = $2',
    [profileId, 'active']
  );
  if (profileCheck.rows.length === 0) {
    res.status(404).json({ error: 'Active tenant profile not found' });
    return;
  }

  await query(
    `INSERT INTO interest_expressions (landlord_id, tenant_profile_id, message, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '30 days')
     ON CONFLICT (landlord_id, tenant_profile_id) DO UPDATE SET
       message = EXCLUDED.message, status = 'pending', expires_at = EXCLUDED.expires_at`,
    [req.user!.userId, profileId, message ?? null]
  );

  await query(
    'UPDATE tenant_profiles SET interest_count = interest_count + 1 WHERE id = $1',
    [profileId]
  );

  res.status(201).json({ message: 'Interest expressed' });
});

// POST /api/landlords/save/:profileId
router.post('/save/:profileId', authenticate, requireLandlord, requireSubscription, async (req: AuthRequest, res: Response): Promise<void> => {
  const { notes, tags } = req.body;
  await query(
    `INSERT INTO saved_tenants (landlord_id, tenant_profile_id, notes, tags)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (landlord_id, tenant_profile_id) DO UPDATE SET notes = EXCLUDED.notes, tags = EXCLUDED.tags`,
    [req.user!.userId, req.params.profileId, notes ?? null, tags ?? []]
  );
  res.status(201).json({ message: 'Tenant saved' });
});

// DELETE /api/landlords/save/:profileId
router.delete('/save/:profileId', authenticate, requireLandlord, async (req: AuthRequest, res: Response): Promise<void> => {
  await query(
    'DELETE FROM saved_tenants WHERE landlord_id = $1 AND tenant_profile_id = $2',
    [req.user!.userId, req.params.profileId]
  );
  res.json({ message: 'Removed from saved' });
});

// GET /api/landlords/saved
router.get('/saved', authenticate, requireLandlord, requireSubscription, async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query(
    `SELECT tsv.*, st.notes, st.tags, st.created_at AS saved_at
     FROM saved_tenants st
     JOIN tenant_search_view tsv ON tsv.profile_id = st.tenant_profile_id
     WHERE st.landlord_id = $1
     ORDER BY st.created_at DESC`,
    [req.user!.userId]
  );
  res.json({ saved: result.rows });
});

// GET /api/landlords/interests - Sent interests
router.get('/interests', authenticate, requireLandlord, async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query(
    `SELECT ie.*, tp.legal_name, tp.dba_name, tp.industry, ts.desirability_index
     FROM interest_expressions ie
     JOIN tenant_profiles tp ON tp.id = ie.tenant_profile_id
     LEFT JOIN tenant_scores ts ON ts.tenant_profile_id = tp.id
     WHERE ie.landlord_id = $1
     ORDER BY ie.created_at DESC`,
    [req.user!.userId]
  );
  res.json({ interests: result.rows });
});

// GET /api/landlords/alerts
router.get('/alerts', authenticate, requireLandlord, async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query(
    'SELECT * FROM search_alerts WHERE landlord_id = $1 ORDER BY created_at DESC',
    [req.user!.userId]
  );
  res.json({ alerts: result.rows });
});

// POST /api/landlords/alerts
router.post('/alerts', authenticate, requireLandlord, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, filters, notifyEmail, frequency } = req.body;
  const result = await query<{ id: string }>(
    `INSERT INTO search_alerts (landlord_id, name, filters, notify_email, frequency)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [req.user!.userId, name, JSON.stringify(filters), notifyEmail ?? true, frequency ?? 'daily']
  );
  res.status(201).json({ alertId: result.rows[0].id });
});

// DELETE /api/landlords/alerts/:id
router.delete('/alerts/:id', authenticate, requireLandlord, async (req: AuthRequest, res: Response): Promise<void> => {
  await query(
    'DELETE FROM search_alerts WHERE id = $1 AND landlord_id = $2',
    [req.params.id, req.user!.userId]
  );
  res.json({ message: 'Alert deleted' });
});

// GET /api/landlords/deals (CRM pipeline)
router.get('/deals', authenticate, requireLandlord, requireSubscription, async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query(
    `SELECT d.*, tp.legal_name, tp.dba_name, tp.industry, ts.desirability_index
     FROM deals d
     JOIN tenant_profiles tp ON tp.id = d.tenant_profile_id
     LEFT JOIN tenant_scores ts ON ts.tenant_profile_id = tp.id
     WHERE d.landlord_id = $1
     ORDER BY d.updated_at DESC`,
    [req.user!.userId]
  );
  res.json({ deals: result.rows });
});

// POST /api/landlords/deals
router.post('/deals', authenticate, requireLandlord, async (req: AuthRequest, res: Response): Promise<void> => {
  const { tenantProfileId, stage, propertyAddress, estimatedSqft, estimatedRentPsf, estimatedCloseDate, notes, tags } = req.body;
  const result = await query<{ id: string }>(
    `INSERT INTO deals (landlord_id, tenant_profile_id, stage, property_address, estimated_sqft,
       estimated_rent_psf, estimated_close_date, notes, tags)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [req.user!.userId, tenantProfileId, stage ?? 'prospect', propertyAddress ?? null,
     estimatedSqft ?? null, estimatedRentPsf ?? null, estimatedCloseDate ?? null,
     notes ?? null, tags ?? []]
  );
  res.status(201).json({ dealId: result.rows[0].id });
});

// PUT /api/landlords/deals/:id
router.put('/deals/:id', authenticate, requireLandlord, async (req: AuthRequest, res: Response): Promise<void> => {
  const { stage, propertyAddress, notes, estimatedRentPsf, estimatedCloseDate } = req.body;
  await query(
    `UPDATE deals SET stage = COALESCE($1, stage), property_address = COALESCE($2, property_address),
       notes = COALESCE($3, notes), estimated_rent_psf = COALESCE($4, estimated_rent_psf),
       estimated_close_date = COALESCE($5, estimated_close_date)
     WHERE id = $6 AND landlord_id = $7`,
    [stage, propertyAddress, notes, estimatedRentPsf, estimatedCloseDate, req.params.id, req.user!.userId]
  );

  if (stage) {
    await query(
      'INSERT INTO deal_activities (deal_id, user_id, activity, notes) VALUES ($1,$2,$3,$4)',
      [req.params.id, req.user!.userId, `Stage changed to ${stage}`, notes ?? null]
    );
  }

  res.json({ message: 'Deal updated' });
});

export default router;
