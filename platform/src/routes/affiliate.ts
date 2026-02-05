import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  createAffiliate,
  getAffiliate,
  getAllAffiliates,
  logActivity,
  getAffiliateStats,
  getRecentActivity,
  getAffiliateEarnings,
  getReferralFunnel,
} from '../db';
import type {
  RegisterRequest,
  RegisterResponse,
  ActivityRequest,
  ActivityResponse,
} from '../types';

const router = Router();

// Register a new affiliate agent
router.post('/register', (req: Request, res: Response) => {
  const body = req.body as RegisterRequest;

  if (!body.agentName) {
    res.status(400).json({
      success: false,
      message: 'agentName is required',
    });
    return;
  }

  const affiliateId = `aff_${uuidv4().slice(0, 8)}`;

  try {
    createAffiliate(affiliateId, body.agentName, body.description);

    const response: RegisterResponse = {
      success: true,
      affiliateId,
      message: `Welcome to the Venice Affiliate Program! Your affiliate ID is ${affiliateId}`,
    };

    console.log(`[Register] New agent registered: ${body.agentName} (${affiliateId})`);
    res.status(201).json(response);
  } catch (error) {
    console.error('[Register] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register agent',
    });
  }
});

// Log activity
router.post('/activity', (req: Request, res: Response) => {
  const body = req.body as ActivityRequest;

  if (!body.affiliateId || !body.type || !body.platform) {
    res.status(400).json({
      success: false,
      message: 'affiliateId, type, and platform are required',
    });
    return;
  }

  const affiliate = getAffiliate(body.affiliateId);
  if (!affiliate) {
    res.status(404).json({
      success: false,
      message: 'Affiliate not found',
    });
    return;
  }

  try {
    const activityId = logActivity({
      affiliateId: body.affiliateId,
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
      message: 'Failed to log activity',
    });
  }
});

// Get affiliate stats
router.get('/stats/:affiliateId', (req: Request, res: Response) => {
  const { affiliateId } = req.params;

  const affiliate = getAffiliate(affiliateId);
  if (!affiliate) {
    res.status(404).json({
      success: false,
      message: 'Affiliate not found',
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
      message: 'Failed to get stats',
    });
  }
});

// Get recent activity
router.get('/activity/:affiliateId', (req: Request, res: Response) => {
  const { affiliateId } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;

  const affiliate = getAffiliate(affiliateId);
  if (!affiliate) {
    res.status(404).json({
      success: false,
      message: 'Affiliate not found',
    });
    return;
  }

  try {
    const activity = getRecentActivity(affiliateId, limit);
    res.json({ activity });
  } catch (error) {
    console.error('[Activity] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get activity',
    });
  }
});

// List all affiliates (admin)
router.get('/affiliates', (_req: Request, res: Response) => {
  try {
    const affiliates = getAllAffiliates();
    res.json({ affiliates });
  } catch (error) {
    console.error('[Affiliates] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get affiliates',
    });
  }
});

export default router;
