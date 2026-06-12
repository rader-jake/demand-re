import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import bcrypt from 'bcryptjs';
import { query } from '../config/database';
import { signToken, signRefreshToken, verifyRefreshToken } from '../config/jwt';
import { validate } from '../middleware/validate';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/auth/register
router.post(
  '/register',
  [
    body('email').isEmail(),
    body('password').isLength({ min: 8 }).matches(/^(?=.*[A-Z])(?=.*\d)/),
    body('role').isIn(['tenant', 'landlord']),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
  ],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    const { email, password, role, firstName, lastName, phone } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query<{ id: string; role: string }>(
      `INSERT INTO users (email, password_hash, role, first_name, last_name, phone)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, role, email, first_name, last_name`,
      [normalizedEmail, passwordHash, role, firstName, lastName, phone ?? null]
    );

    const user = result.rows[0] as Record<string, string>;

    // Meta Lead Ads matching, linking, and auto-bootstrapping
    try {
      const leadResult = await query<{
        id: string;
        meta_lead_id: string;
      }>(
        'SELECT id, meta_lead_id FROM meta_leads WHERE LOWER(email) = $1 ORDER BY created_time DESC LIMIT 1',
        [normalizedEmail]
      );

      if (leadResult.rows.length > 0) {
        const lead = leadResult.rows[0];

        // Link user_id and set status
        await query(
          "UPDATE meta_leads SET user_id = $1, lead_status = 'linked' WHERE id = $2",
          [user.id, lead.id]
        );

        if (role === 'tenant') {
          // Link user_id in tenant_requirements matching source_lead_id or email
          await query(
            `UPDATE tenant_requirements
             SET user_id = $1
             WHERE source_lead_id = $2 OR LOWER(email) = $3`,
            [user.id, lead.meta_lead_id, normalizedEmail]
          );
        }
      } else if (role === 'tenant') {
        // Link any matching tenant requirements directly by email
        await query(
          "UPDATE tenant_requirements SET user_id = $1 WHERE LOWER(email) = $2 AND user_id IS NULL",
          [user.id, normalizedEmail]
        );
      }
    } catch (linkError) {
      console.error('Failed to link lead/requirement during registration:', linkError);
    }

    const payload = { userId: user.id, id: user.id, email: normalizedEmail, role: user.role as 'tenant' | 'landlord' | 'admin', firstName, lastName };
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
  [body('email').isEmail(), body('password').notEmpty()],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    const result = await query<Record<string, string>>(
      `SELECT id, email, password_hash, role, first_name, last_name, is_active
       FROM users WHERE LOWER(email) = $1`,
      [normalizedEmail]
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

// GET /api/auth/activate - Verify token and get name
router.get('/activate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, token } = req.query as Record<string, string>;
    if (!email || !token) {
      res.status(400).json({ error: 'Email and token are required' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Verify activation record
    const activationResult = await query(
      `SELECT * FROM account_activations
       WHERE LOWER(email) = $1 AND token = $2 AND is_completed = FALSE`,
      [normalizedEmail, token]
    );

    if (activationResult.rows.length === 0) {
      res.json({ valid: false, error: 'Invalid or already completed activation token' });
      return;
    }

    const activation = activationResult.rows[0] as { expires_at: Date };
    if (new Date(activation.expires_at) < new Date()) {
      res.json({ valid: false, error: 'Activation token has expired' });
      return;
    }

    // Check if user already exists
    const existingUser = await query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
    if (existingUser.rows.length > 0) {
      res.json({ valid: false, error: 'Account has already been activated' });
      return;
    }

    // 2. Fetch full name
    const reqResult = await query<{ full_name: string | null }>(
      'SELECT full_name FROM tenant_requirements WHERE LOWER(email) = $1 ORDER BY created_at DESC LIMIT 1',
      [normalizedEmail]
    );

    const fullName = reqResult.rows[0]?.full_name || null;

    res.json({
      valid: true,
      email: normalizedEmail,
      name: fullName
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/activate
router.post(
  '/activate',
  [
    body('email').isEmail(),
    body('token').notEmpty(),
    body('password').isLength({ min: 8 }).matches(/^(?=.*[A-Z])(?=.*\d)/),
  ],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    const { email, token, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Verify activation record
    const activationResult = await query(
      `SELECT * FROM account_activations
       WHERE LOWER(email) = $1 AND token = $2 AND is_completed = FALSE`,
      [normalizedEmail, token]
    );

    if (activationResult.rows.length === 0) {
      res.status(400).json({ error: 'Invalid or already completed activation token' });
      return;
    }

    const activation = activationResult.rows[0] as { expires_at: Date };
    if (new Date(activation.expires_at) < new Date()) {
      res.status(400).json({ error: 'Activation token has expired' });
      return;
    }

    // Check if user already exists
    const existingUser = await query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
    if (existingUser.rows.length > 0) {
      res.status(400).json({ error: 'Account has already been activated' });
      return;
    }

    // 2. Fetch full name and phone from requirements to seed user profile
    const reqResult = await query<{ full_name: string | null; phone: string | null }>(
      'SELECT full_name, phone FROM tenant_requirements WHERE LOWER(email) = $1 ORDER BY created_at DESC LIMIT 1',
      [normalizedEmail]
    );

    const fullName = reqResult.rows[0]?.full_name || '';
    const phone = reqResult.rows[0]?.phone || null;

    let firstName = 'Tenant';
    let lastName = 'User';
    if (fullName) {
      const parts = fullName.trim().split(/\s+/);
      if (parts.length > 0) {
        firstName = parts[0];
        if (parts.length > 1) {
          lastName = parts.slice(1).join(' ');
        }
      }
    }

    // 3. Create the user
    const passwordHash = await bcrypt.hash(password, 10);
    const userResult = await query<{ id: string; role: string; email: string; first_name: string; last_name: string }>(
      `INSERT INTO users (email, password_hash, role, first_name, last_name, phone)
       VALUES ($1, $2, 'tenant', $3, $4, $5) RETURNING id, role, email, first_name, last_name`,
      [normalizedEmail, passwordHash, firstName, lastName, phone]
    );
    const user = userResult.rows[0];

    // 4. Link all requirements and leads with matching email
    await query('UPDATE tenant_requirements SET user_id = $1 WHERE LOWER(email) = $2', [user.id, normalizedEmail]);
    await query("UPDATE meta_leads SET user_id = $1, lead_status = 'linked' WHERE LOWER(email) = $2", [user.id, normalizedEmail]);

    // 5. Mark activation complete
    await query('UPDATE account_activations SET is_completed = TRUE WHERE LOWER(email) = $1', [normalizedEmail]);

    // 6. Log the user in
    const payload = { userId: user.id, id: user.id, email: user.email, role: 'tenant' as const, firstName, lastName };
    const accessToken = signToken(payload);
    const refreshToken = signRefreshToken(payload);

    res.status(200).json({
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
