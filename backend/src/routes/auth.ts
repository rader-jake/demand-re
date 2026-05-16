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

export default router;
