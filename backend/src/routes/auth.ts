import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import bcrypt from 'bcryptjs';
import { query } from '../config/database';
import { signToken, signRefreshToken, verifyRefreshToken } from '../config/jwt';
import { validate } from '../middleware/validate';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ScoringService } from '../services/scoring';

const router = Router();

// POST /api/auth/register
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).matches(/^(?=.*[A-Z])(?=.*\d)/),
    body('role').isIn(['tenant', 'landlord']),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
  ],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    const { email, password, role, firstName, lastName, phone } = req.body;

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query<{ id: string; role: string }>(
      `INSERT INTO users (email, password_hash, role, first_name, last_name, phone)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, role, email, first_name, last_name`,
      [email, passwordHash, role, firstName, lastName, phone ?? null]
    );

    const user = result.rows[0] as Record<string, string>;

    // Meta Lead Ads matching, linking, and auto-bootstrapping
    try {
      const leadResult = await query<{
        id: string;
        business_type: string | null;
        full_name: string | null;
        space_type: string | null;
        ideal_space_description: string | null;
        currently_operating: string | null;
        desired_location: string | null;
        space_size: string | null;
        monthly_budget: string | null;
        move_timeline: string | null;
      }>(
        'SELECT * FROM meta_leads WHERE LOWER(email) = LOWER($1) ORDER BY created_time DESC LIMIT 1',
        [email]
      );

      if (leadResult.rows.length > 0) {
        const lead = leadResult.rows[0];

        // Link user_id and set status
        await query(
          "UPDATE meta_leads SET user_id = $1, lead_status = 'linked' WHERE id = $2",
          [user.id, lead.id]
        );

        if (role === 'tenant') {
          // Check if profile already exists to be safe
          const existingProfile = await query('SELECT id FROM tenant_profiles WHERE user_id = $1', [user.id]);
          if (existingProfile.rows.length === 0) {
            const legalName = lead.business_type || lead.full_name || `${firstName} ${lastName}`;
            const industry = lead.business_type || 'Other';
            const spaceUseType = mapSpaceUseType(lead.space_type);
            const yearsInOperation = lead.currently_operating && 
              (['yes', 'true', 'y', '1', 'operating'].includes(lead.currently_operating.toLowerCase().trim())) ? 2 : 0;

            const profileResult = await query<{ id: string }>(
              `INSERT INTO tenant_profiles (user_id, legal_name, industry, space_use_type, years_in_operation, description, status)
               VALUES ($1, $2, $3, $4, $5, $6, 'draft')
               RETURNING id`,
              [user.id, legalName, industry, spaceUseType, yearsInOperation, lead.ideal_space_description || null]
            );

            const profileId = profileResult.rows[0].id;
            const { min: sqftMin, max: sqftMax } = parseSqft(lead.space_size);
            const { min: budgetMin, max: budgetMax } = parseBudget(lead.monthly_budget);

            await query(
              `INSERT INTO tenant_space_requirements (
                 tenant_profile_id, preferred_neighborhoods, sqft_min, sqft_max,
                 budget_monthly_min, budget_monthly_max, timeline_notes
               ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                profileId,
                lead.desired_location ? [lead.desired_location] : [],
                sqftMin,
                sqftMax,
                budgetMin,
                budgetMax,
                lead.move_timeline || null
              ]
            );

            // Compute scores
            await ScoringService.computeAndSave(profileId);
          }
        }
      }
    } catch (linkError) {
      console.error('Failed to link lead during registration:', linkError);
    }

    const payload = { userId: user.id, id: user.id, email, role: user.role as 'tenant' | 'landlord' | 'admin', firstName, lastName };
    const accessToken = signToken(payload);
    const refreshToken = signRefreshToken(payload);

    res.status(201).json({
      accessToken,
      refreshToken,
      user: { id: user.id, email, role: user.role, firstName, lastName },
    });
  }
);

// POST /api/auth/login
router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    const result = await query<Record<string, string>>(
      `SELECT id, email, password_hash, role, first_name, last_name, is_active
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const user = result.rows[0];

    if (!user.is_active) {
      res.status(403).json({ error: 'Account deactivated' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const payload = { userId: user.id, id: user.id, email: user.email, role: user.role as 'tenant' | 'landlord' | 'admin', firstName: user.first_name, lastName: user.last_name };
    const accessToken = signToken(payload);
    const refreshToken = signRefreshToken(payload);

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
      },
    });
  }
);

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ error: 'Refresh token required' });
    return;
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    const userResult = await query<{ is_active: boolean }>(
      'SELECT is_active FROM users WHERE id = $1',
      [payload.userId]
    );

    if (!userResult.rows[0]?.is_active) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    const newPayload = { userId: payload.userId, id: payload.userId, email: payload.email, role: payload.role, firstName: payload.firstName, lastName: payload.lastName };
    res.json({ accessToken: signToken(newPayload) });
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query<Record<string, string>>(
    `SELECT id, email, role, first_name, last_name, phone, avatar_url, is_verified, created_at
     FROM users WHERE id = $1`,
    [req.user!.userId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ user: result.rows[0] });
});

// PUT /api/auth/me
router.put('/me', authenticate,
  [body('firstName').optional().trim().notEmpty(), body('lastName').optional().trim().notEmpty()],
  validate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { firstName, lastName, phone } = req.body;
    await query(
      `UPDATE users SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name),
       phone = COALESCE($3, phone) WHERE id = $4`,
      [firstName ?? null, lastName ?? null, phone ?? null, req.user!.userId]
    );
    res.json({ message: 'Profile updated' });
  }
);

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

function parseSqft(val: string | null): { min: number | null; max: number | null } {
  if (!val) return { min: null, max: null };
  const numbers = val.replace(/,/g, '').match(/\d+/g);
  if (!numbers || numbers.length === 0) return { min: null, max: null };
  if (numbers.length === 1) {
    const size = parseInt(numbers[0], 10);
    return { min: Math.round(size * 0.9), max: Math.round(size * 1.1) };
  }
  return { min: parseInt(numbers[0], 10), max: parseInt(numbers[1], 10) };
}

function parseBudget(val: string | null): { min: number | null; max: number | null } {
  if (!val) return { min: null, max: null };
  const numbers = val.replace(/,/g, '').match(/\d+/g);
  if (!numbers || numbers.length === 0) return { min: null, max: null };
  if (numbers.length === 1) {
    const budget = parseInt(numbers[0], 10);
    return { min: Math.round(budget * 0.9), max: Math.round(budget * 1.1) };
  }
  return { min: parseInt(numbers[0], 10), max: parseInt(numbers[1], 10) };
}

export default router;
