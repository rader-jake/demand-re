import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { ScoringService } from '../services/scoring';
import { normalizeMetaCsvRows } from '../utils/metaCsvHelper';
import { sendActivationEmail, resend } from '../services/emailService';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { uploadFileToPublicStorage } from '../services/uploadService';

const router = Router();

// Configure multer for file uploads
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10) * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|gif/;
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mime = allowedTypes.test(file.mimetype);
    if (ext && mime) {
      cb(null, true);
    } else {
      cb(new Error('Only images (jpeg, jpg, png, webp, gif) are allowed'));
    }
  }
});

// Helper for Nominatim geocoding
async function geocodeAddress(address?: string, city?: string, state?: string): Promise<{ lat: number; lng: number } | null> {
  if (!address) return null;
  try {
    const queryParts = [address, city, state].filter(Boolean);
    const queryStr = encodeURIComponent(queryParts.join(', '));
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${queryStr}&limit=1`, {
      headers: {
        'User-Agent': 'CRE-Marketplace-Admin'
      }
    });
    if (!response.ok) return null;
    const data = (await response.json()) as any[];
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }
  } catch (error) {
    console.error('Nominatim geocoding failed for:', address, error);
  }
  return null;
}

// POST /api/admin/upload
// Handles multiple image uploads for manual matches
router.post(
  '/upload',
  authenticate,
  requireAdmin,
  upload.array('files', 10),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({ error: 'No files uploaded' });
        return;
      }
      
      const urls = await Promise.all(
        files.map(async (file) => {
          try {
            const publicUrl = await uploadFileToPublicStorage(file.path);
            // Delete local file on success
            try {
              if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
              }
            } catch (unlinkErr) {
              console.error('Failed to delete temporary uploaded file:', unlinkErr);
            }
            return publicUrl;
          } catch (uploadErr) {
            console.error(`Failed to upload ${file.filename} to public storage, falling back to local path:`, uploadErr);
            // Keep local file on disk and return local path
            return `/uploads/${file.filename}`;
          }
        })
      );

      res.json({ urls });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'File upload failed' });
    }
  }
);

// GET /api/admin/users
router.get('/users', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { role, search, page = '1', limit = '50' } = req.query as Record<string, string>;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  if (role) { conditions.push(`role = $${p++}`); params.push(role); }
  if (search) {
    conditions.push(`(email ILIKE $${p} OR first_name ILIKE $${p} OR last_name ILIKE $${p})`);
    params.push(`%${search}%`); p++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const [users, count] = await Promise.all([
    query(
      `SELECT id, email, role, first_name, last_name, is_verified, is_active, last_login_at, created_at
       FROM users ${where} ORDER BY created_at DESC LIMIT $${p} OFFSET $${p + 1}`,
      [...params, parseInt(limit), offset]
    ),
    query(`SELECT COUNT(*) AS total FROM users ${where}`, params),
  ]);

  res.json({
    users: users.rows,
    pagination: {
      total: parseInt((count.rows[0] as { total: string }).total),
      page: parseInt(page),
      limit: parseInt(limit),
    },
  });
});

// PUT /api/admin/users/:id/status
router.put('/users/:id/status', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { isActive } = req.body;
  await query('UPDATE users SET is_active = $1 WHERE id = $2', [isActive, req.params.id]);
  res.json({ message: 'User status updated' });
});

// GET /api/admin/analytics/overview
router.get('/analytics/overview', authenticate, requireAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  const [
    userStats, tenantStats, landlordStats,
    interestStats, messageStats, recentEvents,
  ] = await Promise.all([
    query(`
      SELECT
        COUNT(*) AS total_users,
        COUNT(*) FILTER (WHERE role = 'tenant') AS total_tenants,
        COUNT(*) FILTER (WHERE role = 'landlord') AS total_landlords,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS new_this_week,
        COUNT(*) FILTER (WHERE last_login_at > NOW() - INTERVAL '7 days') AS active_this_week
      FROM users WHERE is_active = TRUE
    `),
    query(`
      SELECT
        COUNT(*) AS total_profiles,
        COUNT(*) FILTER (WHERE status = 'active') AS active_profiles,
        COUNT(*) FILTER (WHERE status = 'draft') AS draft_profiles,
        ROUND(AVG(profile_completeness), 1) AS avg_completeness,
        ROUND(AVG(view_count), 1) AS avg_views,
        ROUND(AVG(interest_count), 1) AS avg_interests
      FROM tenant_profiles
    `),
    query(`
      SELECT COUNT(*) AS total FROM landlord_profiles
    `),
    query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE status = 'accepted') AS accepted,
        COUNT(*) FILTER (WHERE status = 'declined') AS declined,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS this_week
      FROM interest_expressions
    `),
    query(`
      SELECT COUNT(*) AS total_messages,
             COUNT(DISTINCT conversation_id) AS total_conversations
      FROM messages
    `),
    query(`
      SELECT event_type, COUNT(*) AS count
      FROM user_events
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY event_type
      ORDER BY count DESC
    `),
  ]);

  res.json({
    users: userStats.rows[0],
    tenants: tenantStats.rows[0],
    landlords: landlordStats.rows[0],
    interests: interestStats.rows[0],
    messages: messageStats.rows[0],
    recentEvents: recentEvents.rows,
  });
});

// GET /api/admin/analytics/demand-heatmap
router.get('/analytics/demand-heatmap', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { period = '30' } = req.query as { period?: string };

  const result = await query(`
    SELECT
      tsr.preferred_neighborhoods,
      tp.industry,
      tp.space_use_type,
      COUNT(*) AS tenant_count,
      ROUND(AVG(tsr.budget_psf_min), 2) AS avg_budget_psf_min,
      ROUND(AVG(tsr.budget_psf_max), 2) AS avg_budget_psf_max,
      ROUND(AVG(tsr.sqft_min), 0) AS avg_sqft_min,
      ROUND(AVG(tsr.sqft_max), 0) AS avg_sqft_max
    FROM tenant_profiles tp
    JOIN tenant_space_requirements tsr ON tsr.tenant_profile_id = tp.id
    WHERE tp.status = 'active'
      AND tp.updated_at > NOW() - INTERVAL '${parseInt(period, 10)} days'
    GROUP BY tsr.preferred_neighborhoods, tp.industry, tp.space_use_type
    ORDER BY tenant_count DESC
  `);

  // Also pull precomputed heatmap
  const heatmap = await query(`
    SELECT * FROM demand_heatmap
    WHERE period_start >= NOW() - INTERVAL '${parseInt(period, 10)} days'
    ORDER BY search_count DESC
  `);

  res.json({ liveDemand: result.rows, heatmapData: heatmap.rows });
});

// GET /api/admin/analytics/tenant-insights
router.get('/analytics/tenant-insights', authenticate, requireAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  const [
    byIndustry, byNeighborhood, byFunding, byRevenue, scoreDist, expansion,
  ] = await Promise.all([
    query(`
      SELECT tp.industry, COUNT(*) AS count,
             ROUND(AVG(ts.desirability_index), 1) AS avg_score
      FROM tenant_profiles tp
      LEFT JOIN tenant_scores ts ON ts.tenant_profile_id = tp.id
      WHERE tp.status = 'active'
      GROUP BY tp.industry ORDER BY count DESC
    `),
    query(`
      SELECT UNNEST(tsr.preferred_neighborhoods) AS neighborhood, COUNT(*) AS demand_count
      FROM tenant_space_requirements tsr
      JOIN tenant_profiles tp ON tp.id = tsr.tenant_profile_id
      WHERE tp.status = 'active'
      GROUP BY neighborhood ORDER BY demand_count DESC LIMIT 20
    `),
    query(`
      SELECT funding_status, COUNT(*) AS count
      FROM tenant_profiles WHERE status = 'active' AND funding_status IS NOT NULL
      GROUP BY funding_status ORDER BY count DESC
    `),
    query(`
      SELECT revenue_range, COUNT(*) AS count
      FROM tenant_profiles WHERE status = 'active' AND revenue_range IS NOT NULL
      GROUP BY revenue_range ORDER BY count DESC
    `),
    query(`
      SELECT
        CASE WHEN desirability_index >= 80 THEN 'A (80-100)'
             WHEN desirability_index >= 65 THEN 'B (65-79)'
             WHEN desirability_index >= 50 THEN 'C (50-64)'
             ELSE 'D (<50)' END AS tier,
        COUNT(*) AS count
      FROM tenant_scores GROUP BY tier ORDER BY tier
    `),
    query(`
      SELECT tp.industry, COUNT(*) AS count,
             ROUND(AVG(tp.number_of_locations), 1) AS avg_locations,
             ROUND(AVG(ts.expansion_likelihood_score), 1) AS avg_expansion_score
      FROM tenant_profiles tp
      LEFT JOIN tenant_scores ts ON ts.tenant_profile_id = tp.id
      WHERE tp.status = 'active'
      GROUP BY tp.industry ORDER BY avg_expansion_score DESC NULLS LAST LIMIT 10
    `),
  ]);

  res.json({
    byIndustry: byIndustry.rows,
    byNeighborhood: byNeighborhood.rows,
    byFunding: byFunding.rows,
    byRevenue: byRevenue.rows,
    scoreDistribution: scoreDist.rows,
    expansionLeaders: expansion.rows,
  });
});

// GET /api/admin/analytics/export
router.get('/analytics/export', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { type = 'tenants' } = req.query as { type?: string };

  let data: unknown[];

  if (type === 'tenants') {
    const result = await query(`
      SELECT tp.legal_name, tp.dba_name, tp.industry, tp.space_use_type,
             tp.years_in_operation, tp.number_of_locations, tp.funding_status,
             tp.revenue_range, tp.credit_score_range, tp.status, tp.profile_completeness,
             tsr.preferred_neighborhoods, tsr.sqft_min, tsr.sqft_max,
             tsr.budget_psf_min, tsr.budget_psf_max,
             ts.financial_strength_score, ts.expansion_likelihood_score,
             ts.market_desirability_score, ts.desirability_index,
             tp.created_at
      FROM tenant_profiles tp
      LEFT JOIN tenant_space_requirements tsr ON tsr.tenant_profile_id = tp.id
      LEFT JOIN tenant_scores ts ON ts.tenant_profile_id = tp.id
      ORDER BY tp.created_at DESC
    `);
    data = result.rows;
  } else if (type === 'events') {
    const result = await query(`
      SELECT event_type, entity_type, properties, created_at
      FROM user_events WHERE created_at > NOW() - INTERVAL '30 days'
      ORDER BY created_at DESC LIMIT 10000
    `);
    data = result.rows;
  } else {
    data = [];
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${type}-export-${new Date().toISOString().split('T')[0]}.json"`);
  res.json({ exported_at: new Date().toISOString(), type, count: data.length, data });
});

// GET /api/admin/requirements
// Returns requirements with search, status filtering, and pagination
router.get('/requirements', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { search, lead_status, page = '1', limit = '50' } = req.query as Record<string, string>;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  if (lead_status) {
    conditions.push(`status = $${p++}`);
    params.push(lead_status);
  }

  if (search) {
    conditions.push(`(full_name ILIKE $${p} OR email ILIKE $${p} OR business_type ILIKE $${p} OR move_timeline_label ILIKE $${p})`);
    params.push(`%${search}%`);
    p++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitVal = parseInt(limit, 10);
  const offsetVal = (parseInt(page, 10) - 1) * limitVal;

  const [requirements, count] = await Promise.all([
    query(
      `SELECT *, created_at AS created_time FROM tenant_requirements ${where} ORDER BY created_at DESC LIMIT $${p} OFFSET $${p + 1}`,
      [...params, limitVal, offsetVal]
    ),
    query(`SELECT COUNT(*) AS total FROM tenant_requirements ${where}`, params),
  ]);

  // Keep both keys for compatibility
  res.json({
    leads: requirements.rows.map((r: any) => ({
      ...r,
      lead_status: r.status,
      desired_location: r.neighborhoods ? r.neighborhoods[0] : null,
      space_type: r.space_types ? r.space_types[0] : null,
      space_size: r.max_square_feet ? `${r.min_square_feet}-${r.max_square_feet}` : null,
      monthly_budget: r.max_monthly_budget ? `${r.min_monthly_budget}-${r.max_monthly_budget}` : null,
      move_timeline: r.move_timeline_label,
      phone_number: r.phone
    })),
    requirements: requirements.rows,
    pagination: {
      total: parseInt((count.rows[0] as { total: string }).total, 10),
      page: parseInt(page, 10),
      limit: limitVal,
    },
  });
});

// GET /api/admin/requirements/:id
// Returns single requirement with all associated tenant_matches
router.get('/requirements/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const reqResult = await query('SELECT *, created_at AS created_time FROM tenant_requirements WHERE id = $1', [id]);
  if (reqResult.rows.length === 0) {
    res.status(404).json({ error: 'Requirement not found' });
    return;
  }

  const matchesResult = await query(
    'SELECT * FROM tenant_matches WHERE requirement_id = $1 ORDER BY created_at DESC',
    [id]
  );

  const tr = reqResult.rows[0] as Record<string, any>;
  const leadMapped = {
    ...tr,
    lead_status: tr.status,
    desired_location: tr.neighborhoods ? tr.neighborhoods[0] : null,
    space_type: tr.space_types ? tr.space_types[0] : null,
    space_size: tr.max_square_feet ? `${tr.min_square_feet}-${tr.max_square_feet}` : null,
    monthly_budget: tr.max_monthly_budget ? `${tr.min_monthly_budget}-${tr.max_monthly_budget}` : null,
    move_timeline: tr.move_timeline_label,
    phone_number: tr.phone,
    wants_contact: tr.contact_permission
  };

  res.json({
    ...leadMapped,
    matches: matchesResult.rows,
  });
});

// PATCH /api/admin/requirements/:id
// Updates requirement status
router.patch('/requirements/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { lead_status } = req.body;

  const result = await query(
    'UPDATE tenant_requirements SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [lead_status, id]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Requirement not found' });
    return;
  }

  res.json(result.rows[0]);
});

// POST /api/admin/requirements/:id/matches
// Creates a manual match for a requirement
router.post('/requirements/:id/matches', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const {
    listing_title, listing_url, address, city, state, neighborhood,
    square_feet, rent, space_type, broker_name, broker_phone, broker_email,
    admin_notes, match_score, verification_status, images, include_source_link,
    latitude, longitude
  } = req.body;

  if (!listing_url) {
    res.status(400).json({ error: 'Listing URL is required' });
    return;
  }

  // Geocode address if coordinates are missing
  let lat = latitude !== undefined && latitude !== null && latitude !== '' ? parseFloat(latitude) : null;
  let lng = longitude !== undefined && longitude !== null && longitude !== '' ? parseFloat(longitude) : null;

  if (address && (lat === null || lng === null)) {
    const coords = await geocodeAddress(address, city, state);
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
    }
  }

  const result = await query(
    `INSERT INTO tenant_matches (
       requirement_id, listing_title, listing_url, address, city, state, neighborhood,
       square_feet, rent, space_type, broker_name, broker_phone, broker_email,
       admin_notes, match_score, verification_status, images, include_source_link,
       latitude, longitude
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
     RETURNING *`,
    [
      id, listing_title, listing_url, address, city, state, neighborhood,
      square_feet, rent, space_type, broker_name, broker_phone, broker_email,
      admin_notes, match_score !== undefined && match_score !== null && match_score !== '' ? parseInt(match_score, 10) : null,
      verification_status ?? 'needs_review',
      images ?? [],
      include_source_link === true || include_source_link === 'true',
      lat,
      lng
    ]
  );

  res.status(201).json(result.rows[0]);
});

// PATCH /api/admin/matches/:matchId
// Updates listing match parameters
router.patch('/matches/:matchId', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { matchId } = req.params;
  const fields = req.body;

  const allowedFields = [
    'listing_title', 'listing_url', 'address', 'city', 'state', 'neighborhood',
    'square_feet', 'rent', 'space_type', 'broker_name', 'broker_phone', 'broker_email',
    'admin_notes', 'match_score', 'verification_status', 'tenant_sent',
    'images', 'include_source_link', 'latitude', 'longitude'
  ];

  // Geocode address if updated and coordinates not provided
  if (fields.address && fields.latitude === undefined && fields.longitude === undefined) {
    const coords = await geocodeAddress(fields.address, fields.city, fields.state);
    if (coords) {
      fields.latitude = coords.lat;
      fields.longitude = coords.lng;
    }
  }

  const keys = Object.keys(fields).filter(key => allowedFields.includes(key));
  if (keys.length === 0) {
    res.status(400).json({ error: 'No valid update fields provided' });
    return;
  }

  const sets = keys.map((key, idx) => `"${key}" = $${idx + 2}`);
  const values = keys.map(key => {
    if (key === 'match_score' && fields[key] !== null && fields[key] !== undefined && fields[key] !== '') {
      return parseInt(fields[key], 10);
    }
    return fields[key];
  });

  const result = await query(
    `UPDATE tenant_matches SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
    [matchId, ...values]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Match not found' });
    return;
  }

  res.json(result.rows[0]);
});

// DELETE /api/admin/matches/:matchId
// Deletes a match
router.delete('/matches/:matchId', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { matchId } = req.params;

  const result = await query('DELETE FROM tenant_matches WHERE id = $1 RETURNING id', [matchId]);
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Match not found' });
    return;
  }

  res.json({ message: 'Match deleted successfully', id: matchId });
});

// POST /api/admin/requirements/:id/send-matches
// Generates matches email preview, marks matches as sent, and updates status
router.post('/requirements/:id/send-matches', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { matchIds } = req.body;

  if (!Array.isArray(matchIds) || matchIds.length === 0) {
    res.status(400).json({ error: 'No match IDs provided' });
    return;
  }

  const reqResult = await query('SELECT * FROM tenant_requirements WHERE id = $1', [id]);
  if (reqResult.rows.length === 0) {
    res.status(404).json({ error: 'Requirement not found' });
    return;
  }
  const requirement = reqResult.rows[0] as Record<string, any>;

  const matchesResult = await query(
    'SELECT * FROM tenant_matches WHERE requirement_id = $1 AND id = ANY($2)',
    [id, matchIds]
  );
  const matches = matchesResult.rows;

  if (matches.length === 0) {
    res.status(400).json({ error: 'No matching records found to send' });
    return;
  }

  // Intercept match images and upload local ones (e.g. /uploads/...) on the fly
  const processedMatches = await Promise.all(
    matches.map(async (match: any) => {
      if (Array.isArray(match.images) && match.images.length > 0) {
        let hasChanges = false;
        const newImages = await Promise.all(
          match.images.map(async (img: string) => {
            if (img.startsWith('/uploads/')) {
              try {
                const relativePath = img.replace(/^\//, ''); // remove leading slash
                const localPath = path.resolve(process.cwd(), relativePath);
                if (fs.existsSync(localPath)) {
                  console.log(`[SendMatches] Backfilling local image ${img} to public storage...`);
                  const publicUrl = await uploadFileToPublicStorage(localPath);
                  hasChanges = true;
                  
                  // Optional: Delete local file from disk after successful backfill
                  try {
                    fs.unlinkSync(localPath);
                  } catch (e) {
                    console.error(`[SendMatches] Failed to delete local backfilled file:`, e);
                  }
                  
                  return publicUrl;
                }
              } catch (err: any) {
                console.error(`[SendMatches] Failed to upload local image ${img} on the fly:`, err.message || err);
              }
            }
            return img;
          })
        );

        if (hasChanges) {
          await query(
            'UPDATE tenant_matches SET images = $1 WHERE id = $2',
            [newImages, match.id]
          );
          match.images = newImages;
        }
      }
      return match;
    })
  );

  // Mark selected matches as sent
  await query(
    'UPDATE tenant_matches SET tenant_sent = true WHERE requirement_id = $1 AND id = ANY($2)',
    [id, matchIds]
  );

  // Update status to matches_sent
  await query(
    "UPDATE tenant_requirements SET status = 'Matches Sent' WHERE id = $1",
    [id]
  );

  // Generate Email Preview & Send Email
  const tenantName = requirement.full_name || 'Tenant';
  const subject = `Curated space matches for your requirements - Demand RE`;
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  let textBody = `Hi ${tenantName},\n\n`;
  textBody += `We have manually reviewed your business requirements and found some matches for you:\n\n`;

  processedMatches.forEach((match: any, index: number) => {
    let summaryParts = [];
    if (match.square_feet) summaryParts.push(`${match.square_feet} SF`);
    if (match.space_type) summaryParts.push(`${match.space_type}`);
    if (match.neighborhood || match.city) summaryParts.push(`in ${match.neighborhood || match.city}`);
    if (match.rent) summaryParts.push(`for ${match.rent}`);
    const summaryText = summaryParts.join(' ');

    textBody += `${index + 1}. ${match.listing_title || 'Commercial Listing'}\n`;
    if (summaryText) textBody += `   Summary: ${summaryText}\n`;
    if (match.admin_notes) textBody += `   Notes: ${match.admin_notes}\n`;
    if (match.include_source_link && match.listing_url) textBody += `   Link: ${match.listing_url}\n`;
    textBody += `\n`;
  });

  textBody += `Let us know if you would like to tour any of these spaces or need further assistance!\n\n`;
  textBody += `Best regards,\n`;
  textBody += `Demand RE Team`;

  let htmlBody = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">`;
  htmlBody += `<h2 style="color: #0d2149;">Hi ${tenantName},</h2>`;
  htmlBody += `<p>We have manually reviewed your business requirements and found some matches for you:</p>`;

  processedMatches.forEach((match: any) => {
    let summaryParts = [];
    if (match.square_feet) summaryParts.push(`<strong>Size:</strong> ${match.square_feet} sq ft`);
    if (match.space_type) summaryParts.push(`<strong>Space Type:</strong> ${match.space_type}`);
    if (match.neighborhood || match.city) summaryParts.push(`<strong>Location:</strong> ${match.neighborhood || match.city}`);
    if (match.rent) summaryParts.push(`<strong>Rent:</strong> ${match.rent}`);
    const summaryText = summaryParts.join(' | ');

    htmlBody += `<div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 16px; background-color: #f8fafc;">`;
    htmlBody += `<h3 style="margin-top: 0; color: #0d2149;">${match.listing_title || 'Commercial Space'}</h3>`;
    
    if (summaryText) {
      htmlBody += `<p style="font-size: 14px; color: #475569; margin: 8px 0;">${summaryText}</p>`;
    }

    if (match.admin_notes) {
      htmlBody += `<p style="margin-bottom: 12px; padding: 8px 12px; border-left: 3px solid #60a5fa; background-color: #eff6ff; font-size: 14px;"><em>Notes: ${match.admin_notes}</em></p>`;
    }

    // Include listing images formatted according to tasks
    if (Array.isArray(match.images) && match.images.length > 0) {
      const heroImage = match.images[0];
      const remainingImages = match.images.slice(1);
      
      const heroUrl = heroImage.startsWith('http') ? heroImage : `${baseUrl}${heroImage}`;
      
      htmlBody += `<div style="margin-top: 12px; margin-bottom: 12px;">`;
      
      // Render large hero image wrapped in clickable link with fallback styles
      htmlBody += `<a href="${heroUrl}" target="_blank" style="display: block; text-decoration: none; border: none; outline: none; margin-bottom: 12px;">`;
      htmlBody += `<img src="${heroUrl}" alt="View listing image" style="max-width: 100%; width: 560px; border-radius: 12px; display: block; border: 1px solid #e2e8f0; object-fit: cover; color: #2563eb; text-decoration: underline; font-family: sans-serif; font-size: 14px;" />`;
      htmlBody += `</a>`;
      
      // Render remaining images as a 2-column grid
      if (remainingImages.length > 0) {
        htmlBody += `<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; max-width: 560px; margin-bottom: 12px;">`;
        remainingImages.forEach((img: string) => {
          const imgUrl = img.startsWith('http') ? img : `${baseUrl}${img}`;
          htmlBody += `<a href="${imgUrl}" target="_blank" style="display: block; text-decoration: none; border: none; outline: none;">`;
          htmlBody += `<img src="${imgUrl}" alt="View listing image" style="width: 100%; max-width: 100%; height: 180px; object-fit: cover; border-radius: 8px; display: block; border: 1px solid #e2e8f0; color: #2563eb; text-decoration: underline; font-family: sans-serif; font-size: 14px;" />`;
          htmlBody += `</a>`;
        });
        htmlBody += `</div>`;
      }
      
      htmlBody += `</div>`;
    }

    if (match.include_source_link && match.listing_url) {
      htmlBody += `<a href="${match.listing_url}" target="_blank" style="display: inline-block; padding: 8px 16px; font-size: 14px; font-weight: bold; color: #fff; background-color: #2563eb; text-decoration: none; border-radius: 8px;">View Listing Details</a>`;
    }
    htmlBody += `</div>`;
  });

  htmlBody += `<p>Please let us know if you would like to schedule a tour for any of these options or need more matches!</p>`;
  htmlBody += `<p style="margin-top: 24px;">Best regards,<br/><strong>Demand RE Admin Team</strong></p>`;
  htmlBody += `</div>`;

  // Dispatch the actual email if Resend is configured
  if (resend) {
    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'Demand RE <insights@demand-re.com>',
        to: [requirement.email],
        subject,
        text: textBody,
        html: htmlBody,
      });
    } catch (err: any) {
      console.error('Failed to send email via Resend:', err);
    }
  }

  res.json({
    preview: {
      to: requirement.email,
      subject,
      text: textBody,
      html: htmlBody,
    },
  });
});

// POST /api/admin/requirements/:id/send-activation-email
// Admin-only: Send activation email to a specific requirement lead
router.post(
  '/requirements/:id/send-activation-email',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      // Find tenant_requirement by id
      const reqResult = await query(
        'SELECT id, full_name, email, activation_email_status FROM tenant_requirements WHERE id = $1',
        [id]
      );
      if (reqResult.rows.length === 0) {
        res.status(404).json({ error: 'Requirement not found' });
        return;
      }

      const requirement = reqResult.rows[0] as { id: string; full_name: string; email: string; activation_email_status: string };
      const email = (requirement.email || '').trim().toLowerCase();

      // Require valid email
      if (!email || !email.includes('@')) {
        await query(
          "UPDATE tenant_requirements SET activation_email_status = 'Failed', updated_at = NOW() WHERE id = $1",
          [id]
        );
        res.status(400).json({ error: 'Requirement is missing a valid email address' });
        return;
      }

      // Check if user already exists and is activated
      const userCheck = await query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
      if (userCheck.rows.length > 0) {
        await query(
          "UPDATE tenant_requirements SET activation_email_status = 'Activated', updated_at = NOW() WHERE id = $1",
          [id]
        );
        res.status(400).json({ error: 'A user account with this email is already registered.' });
        return;
      }

      // Fetch or create token
      const tokenCheck = await query(
        `SELECT token FROM account_activations
         WHERE LOWER(email) = $1 AND is_completed = FALSE AND expires_at > NOW()`,
        [email]
      );
      let token = tokenCheck.rows.length > 0 ? tokenCheck.rows[0].token : null;

      if (!token) {
        token = uuidv4();
        await query(`
          INSERT INTO account_activations (email, token, is_completed, created_at, expires_at)
          VALUES ($1, $2, FALSE, NOW(), NOW() + INTERVAL '7 days')
          ON CONFLICT (email) DO UPDATE SET
            token = EXCLUDED.token,
            is_completed = FALSE,
            created_at = NOW(),
            expires_at = NOW() + INTERVAL '7 days'
        `, [email, token]);
      }

      const frontendUrl = (process.env.FRONTEND_URL || 'https://demand-re.com').replace(/\/+$/, '');
      const activationLink = `${frontendUrl}/activate?email=${encodeURIComponent(email)}&token=${token}`;

      // Send email through Resend via emailService
      let emailResult;
      try {
        emailResult = await sendActivationEmail({
          email,
          fullName: requirement.full_name || '',
          activationLink,
        });
      } catch (sendErr: any) {
        console.error(`Resend API failed for requirement ${id}:`, sendErr.message);
        await query(
          `UPDATE tenant_requirements
           SET activation_email_status = 'Failed',
               updated_at = NOW()
           WHERE id = $1`,
          [id]
        );
        res.status(502).json({ error: `Email delivery failed: ${sendErr.message || 'Unknown error'}` });
        return;
      }

      // Update tenant_requirements on success
      await query(
        `UPDATE tenant_requirements
         SET activation_email_sent_at = NOW(),
             activation_email_status = 'Sent',
             updated_at = NOW()
         WHERE id = $1`,
        [id]
      );

      res.json({
        success: true,
        message: 'Activation email sent successfully',
        messageId: emailResult.id,
      });
    } catch (err: any) {
      console.error('Error in send-activation-email endpoint:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/admin/requirements/send-activation-emails
// Admin-only: Send bulk activation emails to selected requirement leads
router.post(
  '/requirements/send-activation-emails',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { requirementIds } = req.body;
    if (!Array.isArray(requirementIds) || requirementIds.length === 0) {
      res.status(400).json({ error: 'requirementIds must be a non-empty array' });
      return;
    }

    let sent_count = 0;
    let skipped_count = 0;
    let failed_count = 0;
    const results: any[] = [];

    const frontendUrl = (process.env.FRONTEND_URL || 'https://demand-re.com').replace(/\/+$/, '');

    for (const reqId of requirementIds) {
      try {
        // Find requirement
        const reqResult = await query(
          'SELECT id, full_name, email FROM tenant_requirements WHERE id = $1',
          [reqId]
        );
        if (reqResult.rows.length === 0) {
          skipped_count++;
          results.push({ id: reqId, status: 'skipped', reason: 'Requirement not found' });
          continue;
        }

        const requirement = reqResult.rows[0] as { id: string; full_name: string; email: string };
        const email = (requirement.email || '').trim().toLowerCase();

        // Skip rows missing email or invalid email
        if (!email || !email.includes('@')) {
          await query(
            "UPDATE tenant_requirements SET activation_email_status = 'Failed', updated_at = NOW() WHERE id = $1",
            [reqId]
          );
          skipped_count++;
          results.push({ id: reqId, status: 'skipped', reason: 'Missing or invalid email' });
          continue;
        }

        // Skip already activated users
        const userCheck = await query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
        if (userCheck.rows.length > 0) {
          await query(
            "UPDATE tenant_requirements SET activation_email_status = 'Activated', updated_at = NOW() WHERE id = $1",
            [reqId]
          );
          skipped_count++;
          results.push({ id: reqId, status: 'skipped', reason: 'User already registered' });
          continue;
        }

        // Fetch or create token
        const tokenCheck = await query(
          `SELECT token FROM account_activations
           WHERE LOWER(email) = $1 AND is_completed = FALSE AND expires_at > NOW()`,
          [email]
        );
        let token = tokenCheck.rows.length > 0 ? tokenCheck.rows[0].token : null;

        if (!token) {
          token = uuidv4();
          await query(`
            INSERT INTO account_activations (email, token, is_completed, created_at, expires_at)
            VALUES ($1, $2, FALSE, NOW(), NOW() + INTERVAL '7 days')
            ON CONFLICT (email) DO UPDATE SET
              token = EXCLUDED.token,
              is_completed = FALSE,
              created_at = NOW(),
              expires_at = NOW() + INTERVAL '7 days'
          `, [email, token]);
        }

        const activationLink = `${frontendUrl}/activate?email=${encodeURIComponent(email)}&token=${token}`;

        // Send email through Resend via emailService
        try {
          const emailResult = await sendActivationEmail({
            email,
            fullName: requirement.full_name || '',
            activationLink,
          });

          // Update tenant_requirements on success
          await query(
            `UPDATE tenant_requirements
             SET activation_email_sent_at = NOW(),
                 activation_email_status = 'Sent',
                 updated_at = NOW()
             WHERE id = $1`,
            [reqId]
          );

          sent_count++;
          results.push({ id: reqId, status: 'sent', messageId: emailResult.id });
        } catch (sendErr: any) {
          console.error(`Resend API bulk send failed for requirement ${reqId}:`, sendErr.message);
          await query(
            `UPDATE tenant_requirements
             SET activation_email_status = 'Failed',
                 updated_at = NOW()
             WHERE id = $1`,
            [reqId]
          );
          failed_count++;
          results.push({ id: reqId, status: 'failed', error: sendErr.message || 'Email delivery failed' });
        }
      } catch (err: any) {
        console.error(`Error sending activation email for requirement ${reqId} in bulk:`, err);
        failed_count++;
        results.push({ id: reqId, status: 'failed', error: err.message || 'Internal error' });
      }
    }

    res.json({
      success: true,
      sent_count,
      skipped_count,
      failed_count,
      results,
    });
  }
);

// POST /api/admin/requirements/manual-import
router.post(
  '/requirements/manual-import',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const fields = req.body;
    const { email } = fields;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const userRes = await query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
    const userId = userRes.rows.length > 0 ? userRes.rows[0].id : null;

    const boroughs = fields.boroughs ? (typeof fields.boroughs === 'string' ? fields.boroughs : JSON.stringify(fields.boroughs)) : '[]';
    const neighborhoods = fields.neighborhoods ? (typeof fields.neighborhoods === 'string' ? fields.neighborhoods : JSON.stringify(fields.neighborhoods)) : '[]';
    const spaceTypes = fields.space_types ? (typeof fields.space_types === 'string' ? fields.space_types : JSON.stringify(fields.space_types)) : '[]';

    const insertRes = await query<{ id: string }>(
      `INSERT INTO tenant_requirements (
        source, source_lead_id, full_name, email, phone, business_type, operating_status,
        location_count, boroughs, neighborhoods, location_flexibility, space_types,
        min_square_feet, max_square_feet, ideal_square_feet,
        min_monthly_budget, max_monthly_budget, budget_flexibility,
        move_timeline_label, target_move_start_date, target_move_end_date,
        urgency_status, ideal_space_description, contact_permission,
        status, freshness_status, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
      RETURNING *`,
      [
        'manual_import',
        fields.source_lead_id || 'manual_' + Date.now(),
        fields.full_name || 'Anonymous',
        normalizedEmail,
        fields.phone || null,
        fields.business_type || 'Other',
        fields.operating_status || 'Currently Operating',
        fields.location_count !== undefined ? parseInt(fields.location_count, 10) : 1,
        boroughs,
        neighborhoods,
        fields.location_flexibility || 'flexible',
        spaceTypes,
        fields.min_square_feet !== undefined ? parseInt(fields.min_square_feet, 10) : null,
        fields.max_square_feet !== undefined ? parseInt(fields.max_square_feet, 10) : null,
        fields.ideal_square_feet !== undefined ? parseInt(fields.ideal_square_feet, 10) : null,
        fields.min_monthly_budget !== undefined ? parseInt(fields.min_monthly_budget, 10) : null,
        fields.max_monthly_budget !== undefined ? parseInt(fields.max_monthly_budget, 10) : null,
        fields.budget_flexibility || 'flexible',
        fields.move_timeline_label || 'Just exploring',
        fields.target_move_start_date || null,
        fields.target_move_end_date || null,
        fields.urgency_status || 'medium',
        fields.ideal_space_description || null,
        fields.contact_permission !== undefined ? !!fields.contact_permission : false,
        fields.status || 'New',
        fields.freshness_status || 'Fresh',
        userId
      ]
    );

    const newReq = insertRes.rows[0] as any;

    // Compute scoring
    res.status(201).json({ requirement: newReq });
  }
);

// POST /api/admin/import-leads/preview
router.post(
  '/import-leads/preview',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { csvData } = req.body;
    if (!csvData || typeof csvData !== 'string') {
      res.status(400).json({ error: 'csvData is required as a string.' });
      return;
    }

    // Size limit validation (e.g. 5MB of string text)
    if (csvData.length > 5 * 1024 * 1024) {
      res.status(400).json({ error: 'CSV data size exceeds limit.' });
      return;
    }

    try {
      const normalizedRows = normalizeMetaCsvRows(csvData);
      const totalRows = normalizedRows.length;

      // Efficiently batch look up duplicates and users
      const reqsRes = await query('SELECT email, source_lead_id, activation_email_sent_at, activation_email_status FROM tenant_requirements');
      const usersRes = await query('SELECT email FROM users');

      const existingEmails = new Set(reqsRes.rows.map((r: any) => (r.email || '').toLowerCase().trim()));
      const existingLeadIds = new Set(reqsRes.rows.map((r: any) => (r.source_lead_id || '').trim()));
      const existingUsers = new Set(usersRes.rows.map((u: any) => (u.email || '').toLowerCase().trim()));
      const reqsMap = new Map<string, any>(reqsRes.rows.map((r: any) => [(r.email || '').toLowerCase().trim(), r]));

      let validRows = 0;
      let invalidRows = 0;
      let duplicateRows = 0;
      let totalUnmappedCount = 0;

      const previewRows = normalizedRows.map((row) => {
        const emailLower = row.email.toLowerCase().trim();
        const hasEmail = !!row.email && row.email.includes('@');

        const reqExists = existingEmails.has(emailLower) || existingLeadIds.has(row.sourceLeadId);
        const hasAccount = existingUsers.has(emailLower);

        let status = 'Ready';
        if (!hasEmail) {
          status = 'Missing Email';
          invalidRows++;
        } else {
          validRows++;
          if (reqExists) {
            status = 'Duplicate';
            duplicateRows++;
          } else if (row.unmappedValues.length > 0) {
            if (row.unmappedValues.includes('businessType')) {
              status = 'Unmapped Business Type';
            } else if (row.unmappedValues.includes('budgetRange')) {
              status = 'Invalid Budget';
            } else {
              status = 'Needs Review';
            }
          }
        }

        totalUnmappedCount += row.unmappedValues.length;

        // Fetch existing email status if it's duplicate
        const existingReq = emailLower ? reqsMap.get(emailLower) : null;

        return {
          ...row,
          hasAccount,
          status,
          activationEmailSentAt: existingReq ? existingReq.activation_email_sent_at : null,
          activationEmailStatus: existingReq ? (existingReq.activation_email_status || 'Not Sent') : 'Not Sent'
        };
      });

      res.json({
        totalRows,
        validRows,
        invalidRows,
        duplicateRows,
        unmappedValues: totalUnmappedCount,
        normalizedPreviewData: previewRows
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to parse CSV data.' });
    }
  }
);

// POST /api/admin/import-leads/commit
router.post(
  '/import-leads/commit',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { selectedRows } = req.body;
    if (!Array.isArray(selectedRows)) {
      res.status(400).json({ error: 'selectedRows must be an array.' });
      return;
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let tokensGenerated = 0;
    const committedRequirements: any[] = [];

    for (let i = 0; i < selectedRows.length; i++) {
      const row = selectedRows[i];
      try {
        const rawEmail = row.email;
        if (!rawEmail || !rawEmail.trim()) {
          skipped++;
          continue;
        }

        const email = rawEmail.trim().toLowerCase();
        const sourceLeadId = row.sourceLeadId || 'meta_csv_' + Date.now() + '_' + i;
        const createdTime = row.createdTime ? new Date(row.createdTime) : new Date();
        const fullName = row.fullName || 'Anonymous';
        const phone = row.phone || null;
        const businessType = row.businessType || 'Other';
        const operatingStatus = row.operatingStatus || 'Other';

        // location_count rules
        const indicatesFirstLocation = operatingStatus === 'Concept / Planning' || operatingStatus === 'Opening First Location';
        const locationCount = indicatesFirstLocation ? 0 : 1;

        const boroughs = row.boroughs || [];
        const neighborhoods = row.neighborhoods || [];
        const spaceTypes = row.spaceTypes || [];
        const minSquareFeet = row.minSquareFeet !== undefined ? row.minSquareFeet : null;
        const maxSquareFeet = row.maxSquareFeet !== undefined ? row.maxSquareFeet : null;
        const idealSquareFeet = maxSquareFeet;
        const squareFeetRangeLabel = row.squareFeetRangeLabel || 'Not sure yet';
        const minMonthlyBudget = row.minMonthlyBudget !== undefined ? row.minMonthlyBudget : null;
        const maxMonthlyBudget = row.maxMonthlyBudget !== undefined ? row.maxMonthlyBudget : null;
        const budgetRangeLabel = row.budgetRangeLabel || 'Not sure yet';
        const moveTimelineLabel = row.moveTimelineLabel || 'Just exploring';

        let targetMoveStartDate = null;
        let targetMoveEndDate = null;
        if (row.targetMoveStartDate) {
          const d = new Date(row.targetMoveStartDate);
          if (!isNaN(d.getTime())) targetMoveStartDate = d;
        }
        if (row.targetMoveEndDate) {
          const d = new Date(row.targetMoveEndDate);
          if (!isNaN(d.getTime())) targetMoveEndDate = d;
        }

        const urgencyStatus = row.urgencyStatus || 'medium';
        const contactPermission = !!row.contactPermission;
        const idealSpaceDescription = row.idealSpaceDescription || null;
        const rawPayload = row.rawPayload || {};

        // Link user if exists
        const userRes = await query<{ id: string }>('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
        const userId = userRes.rows.length > 0 ? userRes.rows[0].id : null;

        // Check if source_lead_id already exists in tenant_requirements
        const existingRes = await query<{ id: string }>('SELECT id FROM tenant_requirements WHERE source_lead_id = $1 OR LOWER(email) = $2', [sourceLeadId, email]);

        let requirementId: string;
        let finalReq: any = null;

        if (existingRes.rows.length > 0) {
          requirementId = existingRes.rows[0].id;

          const updateRes = await query<any>(`
            UPDATE tenant_requirements SET
              full_name = $1, email = $2, phone = $3, business_type = $4, operating_status = $5,
              location_count = $6, boroughs = $7, neighborhoods = $8, space_types = $9,
              min_square_feet = $10, max_square_feet = $11, ideal_square_feet = $12,
              min_monthly_budget = $13, max_monthly_budget = $14,
              move_timeline_label = $15, target_move_start_date = $16, target_move_end_date = $17,
              ideal_space_description = $18, contact_permission = $19,
              budget_range_label = $20, square_feet_range_label = $21,
              user_id = COALESCE(user_id, $22), last_confirmed_at = $23,
              raw_payload = $24, urgency_status = $25, updated_at = NOW()
            WHERE id = $26
            RETURNING *
          `, [
            fullName, email, phone, businessType, operatingStatus,
            locationCount, JSON.stringify(boroughs), JSON.stringify(neighborhoods), JSON.stringify(spaceTypes),
            minSquareFeet, maxSquareFeet, idealSquareFeet,
            minMonthlyBudget, maxMonthlyBudget,
            moveTimelineLabel, targetMoveStartDate, targetMoveEndDate,
            idealSpaceDescription, contactPermission,
            budgetRangeLabel, squareFeetRangeLabel,
            userId, createdTime, JSON.stringify(rawPayload), urgencyStatus, requirementId
          ]);
          finalReq = updateRes.rows[0];
          updated++;
        } else {
          const insertRes = await query<any>(`
            INSERT INTO tenant_requirements (
              source, source_lead_id, full_name, email, phone, business_type, operating_status,
              location_count, boroughs, neighborhoods, location_flexibility, space_types,
              min_square_feet, max_square_feet, ideal_square_feet,
              min_monthly_budget, max_monthly_budget, budget_flexibility,
              move_timeline_label, target_move_start_date, target_move_end_date,
              urgency_status, ideal_space_description, contact_permission,
              status, freshness_status, budget_range_label, square_feet_range_label,
              user_id, raw_payload, last_confirmed_at
            ) VALUES (
              'meta_csv_import', $1, $2, $3, $4, $5, $6, $7, $8, $9, 'flexible', $10,
              $11, $12, $13, $14, $15, 'flexible', $16, $17, $18, $19, $20, $21,
              'New', 'Fresh', $22, $23, $24, $25, $26
            ) RETURNING *
          `, [
            sourceLeadId, fullName, email, phone, businessType, operatingStatus,
            locationCount, JSON.stringify(boroughs), JSON.stringify(neighborhoods), JSON.stringify(spaceTypes),
            minSquareFeet, maxSquareFeet, idealSquareFeet,
            minMonthlyBudget, maxMonthlyBudget,
            moveTimelineLabel, targetMoveStartDate, targetMoveEndDate,
            urgencyStatus, idealSpaceDescription, contactPermission,
            budgetRangeLabel, squareFeetRangeLabel,
            userId, JSON.stringify(rawPayload), createdTime
          ]);
          requirementId = insertRes.rows[0].id;
          finalReq = insertRes.rows[0];
          imported++;
        }

        // Handle activation token if user doesn't exist
        if (!userId) {
          const tokenCheck = await query(
            `SELECT token FROM account_activations
             WHERE LOWER(email) = $1 AND is_completed = FALSE AND expires_at > NOW()`,
            [email]
          );

          let activationToken = tokenCheck.rows.length > 0 ? tokenCheck.rows[0].token : null;
          if (!activationToken) {
            activationToken = uuidv4();
            await query(`
              INSERT INTO account_activations (email, token, is_completed, created_at, expires_at)
              VALUES ($1, $2, FALSE, NOW(), NOW() + INTERVAL '7 days')
              ON CONFLICT (email) DO UPDATE SET
                token = EXCLUDED.token,
                is_completed = FALSE,
                created_at = NOW(),
                expires_at = NOW() + INTERVAL '7 days'
            `, [email, activationToken]);
            tokensGenerated++;
          }
        }

        // Compute scores
        try {
          await ScoringService.computeAndSave(requirementId);
        } catch (scoreErr) {
          console.error(`Failed to calculate scoring for requirement ${requirementId}:`, scoreErr);
        }

        if (finalReq) {
          committedRequirements.push({
            ...finalReq,
            hasAccount: !!userId,
            activation_email_status: finalReq.activation_email_status || 'Not Sent'
          });
        }
      } catch (rowErr) {
        console.error('Row import failed inside commit endpoint:', rowErr);
        skipped++;
      }
    }

    res.json({
      importedCount: imported,
      updatedCount: updated,
      skippedCount: skipped,
      activationLinksGenerated: tokensGenerated,
      requirements: committedRequirements
    });
  }
);

// POST /api/admin/import-leads/send-activations
router.post(
  '/import-leads/send-activations',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { requirementIds } = req.body;
    if (!Array.isArray(requirementIds) || requirementIds.length === 0) {
      res.status(400).json({ error: 'requirementIds must be a non-empty array.' });
      return;
    }

    const frontendUrl = (process.env.FRONTEND_URL || 'https://demand-re.com').replace(/\/+$/, '');

    let successCount = 0;
    let failedCount = 0;

    for (const reqId of requirementIds) {
      try {
        // Fetch requirement
        const reqResult = await query(
          'SELECT id, full_name, email FROM tenant_requirements WHERE id = $1',
          [reqId]
        );
        if (reqResult.rows.length === 0) continue;

        const requirement = reqResult.rows[0] as { id: string; full_name: string; email: string };
        const email = (requirement.email || '').trim().toLowerCase();

        if (!email || !email.includes('@')) {
          await query("UPDATE tenant_requirements SET activation_email_status = 'Failed', updated_at = NOW() WHERE id = $1", [reqId]);
          failedCount++;
          continue;
        }

        // Check if user already exists
        const userCheck = await query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
        if (userCheck.rows.length > 0) {
          await query("UPDATE tenant_requirements SET activation_email_status = 'Activated', updated_at = NOW() WHERE id = $1", [reqId]);
          successCount++;
          continue;
        }

        // Fetch or create token
        const tokenCheck = await query(
          `SELECT token FROM account_activations
           WHERE LOWER(email) = $1 AND is_completed = FALSE AND expires_at > NOW()`,
          [email]
        );
        let token = tokenCheck.rows.length > 0 ? tokenCheck.rows[0].token : null;

        if (!token) {
          token = uuidv4();
          await query(`
            INSERT INTO account_activations (email, token, is_completed, created_at, expires_at)
            VALUES ($1, $2, FALSE, NOW(), NOW() + INTERVAL '7 days')
            ON CONFLICT (email) DO UPDATE SET
              token = EXCLUDED.token,
              is_completed = FALSE,
              created_at = NOW(),
              expires_at = NOW() + INTERVAL '7 days'
          `, [email, token]);
        }

        const activationLink = `${frontendUrl}/activate?email=${encodeURIComponent(email)}&token=${token}`;

        try {
          await sendActivationEmail({
            email,
            fullName: requirement.full_name || '',
            activationLink,
          });

          await query(
            `UPDATE tenant_requirements
             SET activation_email_sent_at = NOW(),
                 activation_email_status = 'Sent',
                 updated_at = NOW()
             WHERE id = $1`,
            [reqId]
          );
          successCount++;
        } catch (sendErr: any) {
          console.error(`Resend API failed for requirement ${reqId}:`, sendErr.message);
          await query(
            `UPDATE tenant_requirements
             SET activation_email_status = 'Failed',
                 updated_at = NOW()
             WHERE id = $1`,
            [reqId]
          );
          failedCount++;
        }
      } catch (err: any) {
        console.error(`Error sending activation email for requirement ${reqId}:`, err.message);
        await query(
          `UPDATE tenant_requirements
           SET activation_email_status = 'Failed',
               updated_at = NOW()
           WHERE id = $1`,
          [reqId]
        );
        failedCount++;
      }
    }

    res.json({
      success: true,
      sentCount: successCount,
      failedCount: failedCount
    });
  }
);

export default router;
