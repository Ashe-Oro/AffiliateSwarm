import { Router, Request, Response } from 'express';
import {
  getAffiliate,
  getAffiliateEarnings,
  getEarningsHistory,
  requestPayout,
  getPayouts,
} from '../db';
import type { PayoutRequest } from '../types';

const router = Router();

// Get earnings summary for an affiliate
router.get('/earnings/:affiliateId', (req: Request, res: Response) => {
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
    const earnings = getAffiliateEarnings(affiliateId);
    res.json({
      success: true,
      earnings,
    });
  } catch (error) {
    console.error('[Earnings] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get earnings',
    });
  }
});

// Get earnings history (individual events)
router.get('/earnings/:affiliateId/history', (req: Request, res: Response) => {
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
    const history = getEarningsHistory(affiliateId, limit);
    res.json({
      success: true,
      affiliateId,
      history,
    });
  } catch (error) {
    console.error('[Earnings History] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get earnings history',
    });
  }
});

// Request a payout
router.post('/earnings/:affiliateId/payout', (req: Request, res: Response) => {
  const { affiliateId } = req.params;
  const body = req.body as PayoutRequest;

  if (!body.amountUsd || body.amountUsd <= 0) {
    res.status(400).json({
      success: false,
      message: 'amountUsd (> 0) is required',
    });
    return;
  }

  const affiliate = getAffiliate(affiliateId);
  if (!affiliate) {
    res.status(404).json({
      success: false,
      message: 'Affiliate not found',
    });
    return;
  }

  try {
    // Check available balance
    const earnings = getAffiliateEarnings(affiliateId);
    if (body.amountUsd > earnings.availableUsd) {
      res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: $${earnings.availableUsd.toFixed(2)}, Requested: $${body.amountUsd.toFixed(2)}`,
      });
      return;
    }

    const payoutId = requestPayout(affiliateId, body.amountUsd, body.walletAddress);

    console.log(`[Payout] Requested: $${body.amountUsd} for ${affiliateId} (payout #${payoutId})`);

    res.status(201).json({
      success: true,
      payoutId,
      amountUsd: body.amountUsd,
      walletAddress: body.walletAddress || null,
      status: 'requested',
      message: `Payout of $${body.amountUsd.toFixed(2)} requested. (In production, this would be processed via x402 crypto rails.)`,
    });
  } catch (error) {
    console.error('[Payout] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request payout',
    });
  }
});

// Get payout history
router.get('/earnings/:affiliateId/payouts', (req: Request, res: Response) => {
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
    const payouts = getPayouts(affiliateId);
    res.json({
      success: true,
      affiliateId,
      payouts,
    });
  } catch (error) {
    console.error('[Payouts] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payouts',
    });
  }
});

export default router;
