import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../config/jwt';
import { query } from '../config/database';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }
  const token = authHeader.substring(7);
  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
    if (!roles.includes(req.user.role)) { res.status(403).json({ error: 'Insufficient permissions' }); return; }
    next();
  };
}

export const requireTenant = requireRole('tenant', 'admin');
export const requireLandlord = requireRole('landlord', 'admin');
export const requireAdmin = requireRole('admin');

export async function requireSubscription(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
  if (req.user.role === 'admin') { next(); return; }
  try {
    const result = await query<{ subscription_status: string }>(
      'SELECT subscription_status FROM users WHERE id = $1', [req.user.userId]
    );
    const status = result.rows[0]?.subscription_status;
    if (status === 'active' || status === 'trialing') {
      next();
    } else {
      res.status(402).json({ error: 'subscription_required', message: 'An active subscription is required.' });
    }
  } catch {
    res.status(500).json({ error: 'Failed to verify subscription' });
  }
}
