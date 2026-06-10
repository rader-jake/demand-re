import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';

import { checkConnection } from './config/database';
import authRoutes from './routes/auth';
import tenantRoutes from './routes/tenants';
import landlordRoutes from './routes/landlords';
import messageRoutes from './routes/messages';
import adminRoutes from './routes/admin';
import analyticsRoutes from './routes/analytics';
import billingRoutes from './routes/billing';
import webhookRoutes from './routes/webhooks';
import logger from './utils/logger';

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

// 6. Set trust proxy first
app.set('trust proxy', 1);

const defaultAllowedOrigins = [
  'https://demand-re.com',
  'https://www.demand-re.com',
  'https://demand-re.vercel.app',
  'http://localhost:3000',
];
const configuredAllowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...configuredAllowedOrigins]));

// 5. Configure CORS
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.options('*', cors());

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

// Security (except CORS which is already handled above)
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many auth attempts' },
});

app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Body parsing
app.use(compression());
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// HTTP request logging
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
  skip: (req) => req.path === '/health' || req.path === '/api/health',
}));

// 2. Add backend root health route
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Demand RE API' });
});

// 3. Add API health route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Database specific health check
app.get('/health', async (_req, res) => {
  const dbOk = await checkConnection();
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'degraded',
    db: dbOk ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// 4. Mount backend routes correctly
app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/landlords', landlordRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/webhooks', webhookRoutes);

// 404 handler (must be registered after all valid routes)
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

app.listen(PORT, async () => {
  logger.info(`CRE Marketplace API running on port ${PORT}`);
  const dbOk = await checkConnection();
  if (!dbOk) {
    logger.warn('Database connection failed on startup. Check DATABASE_URL.');
  } else {
    logger.info('Database connected successfully');
  }
});

export default app;
