import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  findPendingReferralByCode,
  updateReferralSignup,
  convertReferral,
  createVeniceUser,
  getVeniceUser,
  updateUserSpending,
  createEarning,
  getReferral,
} from '../db';
import type { VeniceSignupRequest, VenicePurchaseRequest } from '../types';

const router = Router();

const COMMISSION_RATE = 0.25; // 25% commission

// Simulate a new user signing up on Venice via referral
router.post('/venice/signup', (req: Request, res: Response) => {
  const body = req.body as VeniceSignupRequest;

  if (!body.referralCode || !body.userName) {
    res.status(400).json({
      success: false,
      error: 'referralCode and userName are required',
      hint: 'POST /api/venice/signup with {"referralCode": "aff_XXXX", "userName": "new-user"}',
    });
    return;
  }

  try {
    // Find the most recent pending referral for this code
    const referral = findPendingReferralByCode(body.referralCode);
    if (!referral) {
      res.status(404).json({
        success: false,
        error: 'No pending referral found for this code',
        hint: 'The user must click the referral link first: GET /api/referral/:affiliateId',
      });
      return;
    }

    // Create a simulated Venice user
    const userId = `user_${uuidv4().slice(0, 8)}`;
    const user = createVeniceUser(userId, body.userName, referral.id);

    // Update referral status to signed_up
    updateReferralSignup(referral.id, userId);

    console.log(`[Venice Sim] User signup: ${body.userName} (${userId}) via referral from ${referral.affiliateId}`);

    res.status(201).json({
      success: true,
      userId: user.id,
      referralId: referral.id,
      affiliateId: referral.affiliateId,
      message: `User ${body.userName} signed up via affiliate ${referral.affiliateId}`,
    });
  } catch (error) {
    console.error('[Venice Sim] Signup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process signup',
    });
  }
});

// Simulate a user purchasing API credits on Venice
router.post('/venice/purchase', (req: Request, res: Response) => {
  const body = req.body as VenicePurchaseRequest;

  if (!body.userId || !body.amountUsd || body.amountUsd <= 0) {
    res.status(400).json({
      success: false,
      error: 'userId and amountUsd (> 0) are required',
      hint: 'POST /api/venice/purchase with {"userId": "user_XXXX", "amountUsd": 50}',
    });
    return;
  }

  try {
    const user = getVeniceUser(body.userId);
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
        hint: 'The user must sign up first via POST /api/venice/signup',
      });
      return;
    }

    // Update user spending
    updateUserSpending(body.userId, body.amountUsd);

    // If user came via referral, credit the affiliate
    let earningId: number | null = null;
    let commission = 0;

    if (user.referralId) {
      const referral = getReferral(user.referralId);
      if (referral) {
        // Convert the referral if not already converted
        if (referral.status !== 'converted') {
          convertReferral(referral.id);
        }

        // Calculate and credit commission
        commission = body.amountUsd * COMMISSION_RATE;
        earningId = createEarning(
          referral.affiliateId,
          referral.id,
          commission,
          'api_credit_purchase'
        );

        console.log(
          `[Venice Sim] Purchase: $${body.amountUsd} by ${user.userName} → $${commission} commission to ${referral.affiliateId}`
        );
      }
    } else {
      console.log(`[Venice Sim] Purchase: $${body.amountUsd} by ${user.userName} (no referral)`);
    }

    res.status(201).json({
      success: true,
      purchaseAmountUsd: body.amountUsd,
      affiliateCommission: commission > 0 ? {
        earningId,
        commissionUsd: commission,
        commissionRate: COMMISSION_RATE,
      } : null,
      message: commission > 0
        ? `Purchase of $${body.amountUsd} processed. $${commission} commission credited to affiliate.`
        : `Purchase of $${body.amountUsd} processed. No affiliate referral.`,
    });
  } catch (error) {
    console.error('[Venice Sim] Purchase error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process purchase',
    });
  }
});

export default router;
