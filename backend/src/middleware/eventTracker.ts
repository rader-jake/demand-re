import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { query } from '../config/database';
import logger from '../utils/logger';

export interface TrackEventOptions {
  eventType: string;
  entityType?: string;
  getEntityId?: (req: AuthRequest) => string | undefined;
  getProperties?: (req: AuthRequest, res: Response) => Record<string, unknown>;
}

export function trackEvent(options: TrackEventOptions) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const originalJson = res.json.bind(res);

    res.json = (body: unknown) => {
      // Fire-and-forget analytics write after response
      setImmediate(async () => {
        try {
          await query(
            `INSERT INTO user_events (user_id, session_id, event_type, entity_type, entity_id, properties, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6, $7::inet, $8)`,
            [
              req.user?.userId ?? null,
              req.headers['x-session-id'] ?? null,
              options.eventType,
              options.entityType ?? null,
              options.getEntityId ? options.getEntityId(req) : null,
              JSON.stringify(options.getProperties ? options.getProperties(req, res) : {}),
              req.ip,
              req.headers['user-agent'] ?? null,
            ]
          );
        } catch (err) {
          logger.error('Failed to track event', { error: err, eventType: options.eventType });
        }
      });

      return originalJson(body);
    };

    next();
  };
}
