import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import {
  createAffiliate,
  getAffiliate,
  getAllAffiliates,
  logActivity,
  getAffiliateStats,
  getRecentActivity,
  getAffiliateEarnings,
  getReferralFunnel,
  deleteAffiliate,
} from '../db';
import { requireAuth } from '../middleware/auth';
import type {
  RegisterRequest,
  RegisterResponse,
  ActivityRequest,
  ActivityResponse,
} from '../types';

const router = Router();

// Generate a Venice API key: vnice_ + 32 hex chars
function generateApiKey(): string {
  return `vnice_${crypto.randomBytes(16).toString('hex')}`;
}

// ─── PUBLIC: Registration (no auth required) ──────────────────────

router.post('/register', (req: Request, res: Response) => {
  const body = req.body as RegisterRequest;

  if (!body.agentName) {
    res.status(400).json({
      success: false,
      error: 'agentName is required',
      hint: 'POST /api/register with {"agentName": "your-agent-name", "description": "optional"}',
    });
    return;
  }

  const affiliateId = `aff_${uuidv4().slice(0, 8)}`;
  const apiKey = generateApiKey();

  try {
    createAffiliate(affiliateId, apiKey, body.agentName, body.description);

    const response: RegisterResponse = {
      success: true,
      affiliateId,
      apiKey,
      message: `Welcome to the Venice Affiliate Program! Save your API key immediately — it will not be shown again.`,
    };

    console.log(`[Register] New agent registered: ${body.agentName} (${affiliateId})`);
    res.status(201).json(response);
  } catch (error) {
    console.error('[Register] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register agent',
      hint: 'Try again. If the problem persists, the platform may be temporarily unavailable.',
    });
  }
});

// ─── AUTHENTICATED: All routes below require Bearer token ─────────

// GET /api/me — "who am I?" self-check
router.get('/me', requireAuth, (req: Request, res: Response) => {
  const affiliate = req.affiliate!;

  try {
    const stats = getAffiliateStats(affiliate.id);
    const earnings = getAffiliateEarnings(affiliate.id);
    const funnel = getReferralFunnel(affiliate.id);

    res.json({
      success: true,
      affiliate: {
        id: affiliate.id,
        name: affiliate.name,
        description: affiliate.description,
        registeredAt: affiliate.registeredAt,
        status: affiliate.status,
      },
      stats,
      earnings,
      referralFunnel: funnel,
    });
  } catch (error) {
    console.error('[Me] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get profile',
    });
  }
});

// DELETE /api/me — permanently remove account and all data
router.delete('/me', requireAuth, (req: Request, res: Response) => {
  const affiliate = req.affiliate!;

  try {
    const { deleted, counts } = deleteAffiliate(affiliate.id);

    if (deleted) {
      console.log(`[Delete] Agent removed: ${affiliate.name} (${affiliate.id}) — ${JSON.stringify(counts)}`);
      res.json({
        success: true,
        message: 'Your account and all associated data have been permanently deleted.',
        deleted: {
          affiliateId: affiliate.id,
          activityLogs: counts.activity_logs,
          referrals: counts.referrals,
          earnings: counts.earnings,
          payouts: counts.payouts,
        },
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Account not found',
        hint: 'Your account may have already been deleted.',
      });
    }
  } catch (error) {
    console.error('[Delete] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete account',
      hint: 'Try again. If the problem persists, contact support.',
    });
  }
});

// POST /api/activity — log activity
router.post('/activity', requireAuth, (req: Request, res: Response) => {
  const affiliate = req.affiliate!;
  const body = req.body as ActivityRequest;

  if (!body.type || !body.platform) {
    res.status(400).json({
      success: false,
      error: 'type and platform are required',
      hint: 'POST /api/activity with {"type": "post|reply|like|retweet|search", "platform": "twitter|discord|other", "content": "optional"}',
    });
    return;
  }

  try {
    const activityId = logActivity({
      affiliateId: affiliate.id,
      type: body.type,
      platform: body.platform,
      content: body.content,
      targetId: body.targetId,
      timestamp: new Date().toISOString(),
      metadata: body.metadata,
    });

    const response: ActivityResponse = {
      success: true,
      activityId,
      message: 'Activity logged',
    };

    console.log(`[Activity] ${affiliate.name}: ${body.type} on ${body.platform}`);
    res.status(201).json(response);
  } catch (error) {
    console.error('[Activity] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to log activity',
    });
  }
});

// GET /api/stats/:affiliateId — get stats (must be own account)
router.get('/stats/:affiliateId', requireAuth, (req: Request, res: Response) => {
  const affiliate = req.affiliate!;
  const { affiliateId } = req.params;

  if (affiliate.id !== affiliateId) {
    res.status(403).json({
      success: false,
      error: 'You can only view your own stats',
      hint: `Use your own affiliate ID: ${affiliate.id}`,
    });
    return;
  }

  try {
    const stats = getAffiliateStats(affiliateId);
    const earnings = getAffiliateEarnings(affiliateId);
    const funnel = getReferralFunnel(affiliateId);

    res.json({
      ...stats,
      earnings,
      referralFunnel: funnel,
    });
  } catch (error) {
    console.error('[Stats] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stats',
    });
  }
});

// GET /api/activity/:affiliateId — get recent activity (must be own account)
router.get('/activity/:affiliateId', requireAuth, (req: Request, res: Response) => {
  const affiliate = req.affiliate!;
  const { affiliateId } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;

  if (affiliate.id !== affiliateId) {
    res.status(403).json({
      success: false,
      error: 'You can only view your own activity',
      hint: `Use your own affiliate ID: ${affiliate.id}`,
    });
    return;
  }

  try {
    const activity = getRecentActivity(affiliateId, limit);
    res.json({ success: true, activity });
  } catch (error) {
    console.error('[Activity] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get activity',
    });
  }
});

// GET /api/affiliates — list all affiliates (admin, no auth for now)
router.get('/affiliates', (_req: Request, res: Response) => {
  try {
    const affiliates = getAllAffiliates();
    // Strip API keys from public listing
    const safeList = affiliates.map(({ apiKey, ...rest }) => rest);
    res.json({ affiliates: safeList });
  } catch (error) {
    console.error('[Affiliates] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get affiliates',
    });
  }
});

export default router;
