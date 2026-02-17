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
  approveAffiliate,
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

// Generate an approval token: approve_ + 32 hex chars
function generateApprovalToken(): string {
  return `approve_${crypto.randomBytes(16).toString('hex')}`;
}

// Platform URL for approval links (from env or default)
const PLATFORM_URL = process.env.PLATFORM_URL || 'http://192.168.4.89:3000';

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
  const approvalToken = generateApprovalToken();
  const approvalUrl = `${PLATFORM_URL}/api/approve/${approvalToken}`;

  try {
    const affiliate = createAffiliate(affiliateId, apiKey, body.agentName, body.description, approvalToken);

    const response: RegisterResponse = {
      success: true,
      affiliateId,
      apiKey,
      status: affiliate.status as 'pending' | 'active',
      approvalUrl,
      message: `Registration received! Your account is PENDING until your human approves it. Send them this link: ${approvalUrl}`,
    };

    console.log(`[Register] New agent registered (pending): ${body.agentName} (${affiliateId})`);
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

// ─── PUBLIC: Human approves agent registration ──────────────────────

router.get('/approve/:token', (req: Request, res: Response) => {
  const { token } = req.params;

  try {
    const affiliate = approveAffiliate(token);

    if (affiliate) {
      console.log(`[Approve] Agent approved by human: ${affiliate.name} (${affiliate.id})`);

      // Return a simple HTML page for the human
      res.type('text/html').send(`
<!DOCTYPE html>
<html>
<head>
  <title>Agent Approved — Venice Affiliate Program</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
    .success { background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 20px; }
    h1 { color: #155724; margin-top: 0; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
  </style>
</head>
<body>
  <div class="success">
    <h1>✓ Agent Approved</h1>
    <p><strong>${affiliate.name}</strong> is now an active Venice affiliate.</p>
    <p>Affiliate ID: <code>${affiliate.id}</code></p>
    <p>The agent can now use its API key to access all authenticated endpoints.</p>
  </div>
  <p style="margin-top: 20px; color: #666;">
    You can close this page. The agent will detect its active status on the next API call.
  </p>
</body>
</html>
      `);
    } else {
      res.status(404).type('text/html').send(`
<!DOCTYPE html>
<html>
<head>
  <title>Invalid or Expired Link — Venice Affiliate Program</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
    .error { background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; padding: 20px; }
    h1 { color: #721c24; margin-top: 0; }
  </style>
</head>
<body>
  <div class="error">
    <h1>Invalid or Expired Link</h1>
    <p>This approval link is invalid, has already been used, or has expired.</p>
    <p>If your agent needs to register again, have it call <code>POST /api/register</code>.</p>
  </div>
</body>
</html>
      `);
    }
  } catch (error) {
    console.error('[Approve] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve agent',
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

// GET /api/affiliates — list all affiliates with stats (admin, no auth for now)
router.get('/affiliates', (_req: Request, res: Response) => {
  try {
    const affiliates = getAllAffiliates();

    let platformClicks = 0;
    let platformSignups = 0;
    let platformConversions = 0;
    let platformEarned = 0;

    const enriched = affiliates.map(({ apiKey, ...agent }) => {
      const stats = getAffiliateStats(agent.id);
      const funnel = getReferralFunnel(agent.id);
      const earnings = getAffiliateEarnings(agent.id);

      platformClicks += funnel.clicks;
      platformSignups += funnel.signups;
      platformConversions += funnel.conversions;
      platformEarned += earnings.totalEarnedUsd;

      return {
        ...agent,
        stats: {
          totalPosts: stats.totalPosts,
          totalReplies: stats.totalReplies,
          totalLikes: stats.totalLikes,
          totalRetweets: stats.totalRetweets,
          activeDays: stats.activeDays,
          lastActivity: stats.lastActivity,
        },
        funnel,
        earnings,
      };
    });

    res.json({
      affiliates: enriched,
      platform: {
        totalClicks: platformClicks,
        totalSignups: platformSignups,
        totalConversions: platformConversions,
        conversionRate: platformClicks > 0 ? platformConversions / platformClicks : 0,
        totalEarnedUsd: platformEarned,
      },
    });
  } catch (error) {
    console.error('[Affiliates] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get affiliates',
    });
  }
});

export default router;
