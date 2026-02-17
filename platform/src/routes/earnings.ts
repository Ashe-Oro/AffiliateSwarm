import { Router, Request, Response } from 'express';
import {
  getAffiliateEarnings,
  getEarningsHistory,
  requestPayout,
  getPayouts,
} from '../db';
import { requireAuth } from '../middleware/auth';
import type { PayoutRequest } from '../types';

const router = Router();

// GET /api/earnings/:affiliateId — earnings summary (authenticated, own account only)
router.get('/earnings/:affiliateId', requireAuth, (req: Request, res: Response) => {
  const affiliate = req.affiliate!;
  const { affiliateId } = req.params;

  if (affiliate.id !== affiliateId) {
    res.status(403).json({
      success: false,
      error: 'You can only view your own earnings',
      hint: `Use your own affiliate ID: ${affiliate.id}, or use GET /api/me for a full summary.`,
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
      error: 'Failed to get earnings',
    });
  }
});

// GET /api/earnings/:affiliateId/history — earnings history (authenticated, own account only)
router.get('/earnings/:affiliateId/history', requireAuth, (req: Request, res: Response) => {
  const affiliate = req.affiliate!;
  const { affiliateId } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;

  if (affiliate.id !== affiliateId) {
    res.status(403).json({
      success: false,
      error: 'You can only view your own earnings history',
      hint: `Use your own affiliate ID: ${affiliate.id}`,
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
      error: 'Failed to get earnings history',
    });
  }
});

// POST /api/earnings/:affiliateId/payout — request payout (authenticated, own account only)
router.post('/earnings/:affiliateId/payout', requireAuth, (req: Request, res: Response) => {
  const affiliate = req.affiliate!;
  const { affiliateId } = req.params;
  const body = req.body as PayoutRequest;

  if (affiliate.id !== affiliateId) {
    res.status(403).json({
      success: false,
      error: 'You can only request payouts for your own account',
      hint: `Use your own affiliate ID: ${affiliate.id}`,
    });
    return;
  }

  if (!body.amountUsd || body.amountUsd <= 0) {
    res.status(400).json({
      success: false,
      error: 'amountUsd (> 0) is required',
      hint: 'POST with {"amountUsd": 10.00, "walletAddress": "0xYourWallet"}',
    });
    return;
  }

  try {
    const payout = requestPayout(affiliateId, body.amountUsd, body.walletAddress);

    if (!payout || !payout.payoutId) {
      res.status(500).json({
        success: false,
        error: 'Payout failed unexpectedly',
        hint: 'Try again or check your balance via GET /api/earnings/:affiliateId',
      });
      return;
    }

    console.log(`[Payout] Completed: $${body.amountUsd} for ${affiliateId} (payout #${payout.payoutId})`);

    res.status(201).json({
      success: true,
      payoutId: payout.payoutId,
      amountUsd: body.amountUsd,
      walletAddress: body.walletAddress || null,
      status: payout.status,
      message: `Payout of $${body.amountUsd.toFixed(2)} completed. (Simulated USDC transfer to ${body.walletAddress || 'no wallet provided'}.)`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isInsufficientBalance = message.includes('Insufficient balance');
    const isBusy = message.includes('SQLITE_BUSY') || message.includes('database is locked');
    console.error('[Payout] Error:', message);

    if (isInsufficientBalance) {
      res.status(400).json({
        success: false,
        error: message,
        hint: 'Check your available balance via GET /api/earnings/:affiliateId or GET /api/me',
      });
    } else if (isBusy) {
      res.status(409).json({
        success: false,
        error: 'Another payout is being processed. Try again.',
        hint: 'Wait a moment and retry your payout request.',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to process payout',
        hint: 'Check your balance and try again.',
      });
    }
  }
});

// GET /api/earnings/:affiliateId/payouts — payout history (authenticated, own account only)
router.get('/earnings/:affiliateId/payouts', requireAuth, (req: Request, res: Response) => {
  const affiliate = req.affiliate!;
  const { affiliateId } = req.params;

  if (affiliate.id !== affiliateId) {
    res.status(403).json({
      success: false,
      error: 'You can only view your own payout history',
      hint: `Use your own affiliate ID: ${affiliate.id}`,
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
      error: 'Failed to get payouts',
    });
  }
});

export default router;
