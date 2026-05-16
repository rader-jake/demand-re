import express, { Response } from 'express';
import Stripe from 'stripe';
import { authenticate, requireLandlord, AuthRequest } from '../middleware/auth';
import { query } from '../config/database';
import logger from '../utils/logger';

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-04-22.dahlia',
});

const PRICE_ID = process.env.STRIPE_PRICE_ID || '';
const REPORT_PRICE_CENTS = parseInt(process.env.STRIPE_REPORT_PRICE_CENTS || '5000', 10);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getOrCreateCustomer(userId: string, email: string, name: string): Promise<string> {
  const res = await query<{ stripe_customer_id: string }>(
    'SELECT stripe_customer_id FROM users WHERE id = $1',
    [userId]
  );
  if (res.rows[0]?.stripe_customer_id) return res.rows[0].stripe_customer_id;

  const customer = await stripe.customers.create({ email, name, metadata: { userId } });
  await query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customer.id, userId]);
  return customer.id;
}

async function updateSubscriptionStatus(
  customerId: string,
  status: string,
  subscriptionId?: string,
  trialEnd?: number | null,
  periodEnd?: number | null
) {
  await query(
    `UPDATE users SET
       subscription_status = $1,
       subscription_id = COALESCE($2, subscription_id),
       trial_ends_at = CASE WHEN $3::bigint IS NOT NULL THEN to_timestamp($3::bigint) ELSE trial_ends_at END,
       subscription_ends_at = CASE WHEN $4::bigint IS NOT NULL THEN to_timestamp($4::bigint) ELSE subscription_ends_at END
     WHERE stripe_customer_id = $5`,
    [status, subscriptionId || null, trialEnd || null, periodEnd || null, customerId]
  );
}

// ── GET /billing/status ───────────────────────────────────────────────────────

router.get('/status', authenticate, requireLandlord, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query<{
      subscription_status: string;
      subscription_id: string;
      trial_ends_at: string;
      subscription_ends_at: string;
      stripe_customer_id: string;
    }>(
      'SELECT subscription_status, subscription_id, trial_ends_at, subscription_ends_at, stripe_customer_id FROM users WHERE id = $1',
      [req.user!.id]
    );
    const user = result.rows[0];
    res.json({
      status: user?.subscription_status || 'inactive',
      subscriptionId: user?.subscription_id || null,
      trialEndsAt: user?.trial_ends_at || null,
      subscriptionEndsAt: user?.subscription_ends_at || null,
      hasAccess: ['active', 'trialing'].includes(user?.subscription_status || ''),
    });
  } catch (err) {
    logger.error('Failed to get billing status', { err });
    res.status(500).json({ error: 'Failed to get billing status' });
  }
});

// ── POST /billing/subscribe ───────────────────────────────────────────────────

router.post('/subscribe', authenticate, requireLandlord, async (req: AuthRequest, res: Response) => {
  try {
    const customerId = await getOrCreateCustomer(
      req.user!.id,
      req.user!.email,
      `${req.user!.firstName} ${req.user!.lastName}`
    );

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      subscription_data: {
        trial_period_days: 30,
        metadata: { userId: req.user!.id },
      },
      success_url: `${FRONTEND_URL}/landlord/billing?success=1`,
      cancel_url: `${FRONTEND_URL}/landlord/billing?canceled=1`,
      metadata: { userId: req.user!.id },
    });

    res.json({ url: session.url });
  } catch (err) {
    logger.error('Failed to create checkout session', { err });
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// ── POST /billing/portal ──────────────────────────────────────────────────────

router.post('/portal', authenticate, requireLandlord, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query<{ stripe_customer_id: string }>(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [req.user!.id]
    );
    const customerId = result.rows[0]?.stripe_customer_id;
    if (!customerId) {
      res.status(400).json({ error: 'No billing account found. Please subscribe first.' });
      return;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${FRONTEND_URL}/landlord/billing`,
    });

    res.json({ url: session.url });
  } catch (err) {
    logger.error('Failed to create portal session', { err });
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// ── POST /billing/buy-report ──────────────────────────────────────────────────

router.post('/buy-report', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const customerId = await getOrCreateCustomer(
      req.user!.id,
      req.user!.email,
      `${req.user!.firstName} ${req.user!.lastName}`
    );

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: REPORT_PRICE_CENTS,
          product_data: {
            name: 'Demand RE Market Intelligence Report',
            description: 'Full NYC CRE demand analytics — neighborhoods, industries, budgets, and trends.',
          },
        },
        quantity: 1,
      }],
      success_url: `${FRONTEND_URL}/landlord/billing?report_success=1`,
      cancel_url: `${FRONTEND_URL}/landlord/billing`,
      metadata: { userId: req.user!.id, type: 'report' },
    });

    res.json({ url: session.url });
  } catch (err) {
    logger.error('Failed to create report checkout', { err });
    res.status(500).json({ error: 'Failed to create report checkout' });
  }
});

// ── POST /billing/webhook ─────────────────────────────────────────────────────
// Raw body required — must be registered BEFORE express.json() in index.ts

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  let event: any;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || '');
  } catch (err) {
    logger.error('Webhook signature verification failed', { err });
    res.status(400).json({ error: 'Invalid webhook signature' });
    return;
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as any;
        await updateSubscriptionStatus(
          sub.customer as string,
          sub.status,
          sub.id,
          sub.trial_end,
          sub.current_period_end
        );
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as any;
        await updateSubscriptionStatus(sub.customer as string, 'canceled', sub.id);
        break;
      }
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        if (session.metadata?.type === 'report' && session.metadata?.userId) {
          await query(
            `INSERT INTO report_purchases (user_id, stripe_payment_intent_id, status)
             VALUES ($1, $2, 'completed')`,
            [session.metadata.userId, session.payment_intent]
          );
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        if (invoice.customer) {
          await updateSubscriptionStatus(invoice.customer as string, 'past_due');
        }
        break;
      }
    }
    res.json({ received: true });
  } catch (err) {
    logger.error('Webhook handler error', { err });
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

export default router;
