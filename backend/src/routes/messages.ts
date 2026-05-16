import { Router, Response } from 'express';
import { body } from 'express-validator';
import { query } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

// GET /api/messages/conversations
router.get('/conversations', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const result = await query(
    `SELECT c.*,
            CASE WHEN c.landlord_id = $1 THEN tu.first_name || ' ' || tu.last_name
                 ELSE lu.first_name || ' ' || lu.last_name END AS other_party_name,
            CASE WHEN c.landlord_id = $1 THEN tp.legal_name ELSE lp.company_name END AS context_name,
            (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
            (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND sender_id != $1 AND status = 'sent') AS unread_count
     FROM conversations c
     JOIN users lu ON lu.id = c.landlord_id
     JOIN users tu ON tu.id = c.tenant_id
     LEFT JOIN landlord_profiles lp ON lp.user_id = c.landlord_id
     LEFT JOIN tenant_profiles tp ON tp.user_id = c.tenant_id
     WHERE c.landlord_id = $1 OR c.tenant_id = $1
     ORDER BY c.last_message_at DESC NULLS LAST`,
    [userId]
  );

  res.json({ conversations: result.rows });
});

// GET /api/messages/conversations/:id
router.get('/conversations/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const convId = req.params.id;

  const convResult = await query(
    'SELECT * FROM conversations WHERE id = $1 AND (landlord_id = $2 OR tenant_id = $2)',
    [convId, userId]
  );

  if (convResult.rows.length === 0) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  const messages = await query(
    `SELECT m.*, u.first_name, u.last_name, u.avatar_url
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = $1
     ORDER BY m.created_at ASC`,
    [convId]
  );

  // Mark messages as read
  await query(
    `UPDATE messages SET status = 'read', read_at = NOW()
     WHERE conversation_id = $1 AND sender_id != $2 AND status = 'sent'`,
    [convId, userId]
  );

  res.json({ conversation: convResult.rows[0], messages: messages.rows });
});

// POST /api/messages/conversations - Start a new conversation
router.post(
  '/conversations',
  authenticate,
  [body('recipientId').isUUID(), body('message').trim().notEmpty().isLength({ max: 2000 })],
  validate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const { recipientId, message, subject } = req.body;
    const role = req.user!.role;

    // Determine landlord/tenant order
    let landlordId: string, tenantId: string;
    if (role === 'landlord') {
      landlordId = userId;
      tenantId = recipientId;
    } else {
      landlordId = recipientId;
      tenantId = userId;
    }

    // Get or create conversation
    let convResult = await query<{ id: string }>(
      'SELECT id FROM conversations WHERE landlord_id = $1 AND tenant_id = $2',
      [landlordId, tenantId]
    );

    let convId: string;
    if (convResult.rows.length === 0) {
      const newConv = await query<{ id: string }>(
        `INSERT INTO conversations (landlord_id, tenant_id, subject, last_message_at)
         VALUES ($1, $2, $3, NOW()) RETURNING id`,
        [landlordId, tenantId, subject ?? null]
      );
      convId = newConv.rows[0].id;
    } else {
      convId = convResult.rows[0].id;
    }

    // Insert message
    const msgResult = await query<{ id: string }>(
      `INSERT INTO messages (conversation_id, sender_id, content)
       VALUES ($1, $2, $3) RETURNING id, created_at`,
      [convId, userId, message]
    );

    await query('UPDATE conversations SET last_message_at = NOW() WHERE id = $1', [convId]);

    res.status(201).json({ conversationId: convId, message: msgResult.rows[0] });
  }
);

// POST /api/messages/conversations/:id/messages
router.post(
  '/conversations/:id/messages',
  authenticate,
  [body('content').trim().notEmpty().isLength({ max: 2000 })],
  validate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const convId = req.params.id;

    const convResult = await query(
      'SELECT id FROM conversations WHERE id = $1 AND (landlord_id = $2 OR tenant_id = $2)',
      [convId, userId]
    );

    if (convResult.rows.length === 0) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const msgResult = await query(
      `INSERT INTO messages (conversation_id, sender_id, content)
       VALUES ($1, $2, $3) RETURNING id, content, created_at`,
      [convId, userId, req.body.content]
    );

    await query('UPDATE conversations SET last_message_at = NOW() WHERE id = $1', [convId]);

    res.status(201).json({ message: msgResult.rows[0] });
  }
);

export default router;
