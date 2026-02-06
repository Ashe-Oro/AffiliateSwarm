import { Router, Request, Response } from 'express';
import {
  getAffiliate,
  createReferral,
  getAffiliateReferrals,
  getReferralFunnel,
} from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /api/referral/:affiliateId — track a referral click (PUBLIC — no auth)
// This is what happens when a user visits venice.ai/?ref=aff_XXXX
router.get('/referral/:affiliateId', (req: Request, res: Response) => {
  const { affiliateId } = req.params;

  const affiliate = getAffiliate(affiliateId);
  if (!affiliate) {
    res.status(404).json({
      success: false,
      error: 'Invalid referral code',
      hint: 'The affiliate ID in the referral link is not valid.',
    });
    return;
  }

  try {
    const referralId = createReferral(affiliateId);

    console.log(`[Referral] Click tracked: ${affiliateId} → referral #${referralId}`);

    res.json({
      success: true,
      referralId,
      affiliateId,
      message: 'Referral click tracked. User can now sign up via POST /api/venice/signup with this referralCode.',
      nextStep: {
        endpoint: 'POST /api/venice/signup',
        body: {
          referralCode: affiliateId,
          userName: 'new-user-name',
        },
      },
    });
  } catch (error) {
    console.error('[Referral] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track referral',
    });
  }
});

// GET /api/referrals/:affiliateId — list referrals (authenticated, own account only)
router.get('/referrals/:affiliateId', requireAuth, (req: Request, res: Response) => {
  const affiliate = req.affiliate!;
  const { affiliateId } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;

  if (affiliate.id !== affiliateId) {
    res.status(403).json({
      success: false,
      error: 'You can only view your own referrals',
      hint: `Use your own affiliate ID: ${affiliate.id}`,
    });
    return;
  }

  try {
    const referrals = getAffiliateReferrals(affiliateId, limit);
    res.json({
      success: true,
      affiliateId,
      referrals,
    });
  } catch (error) {
    console.error('[Referrals] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get referrals',
    });
  }
});

// GET /api/referrals/:affiliateId/funnel — funnel stats (authenticated, own account only)
router.get('/referrals/:affiliateId/funnel', requireAuth, (req: Request, res: Response) => {
  const affiliate = req.affiliate!;
  const { affiliateId } = req.params;

  if (affiliate.id !== affiliateId) {
    res.status(403).json({
      success: false,
      error: 'You can only view your own referral funnel',
      hint: `Use your own affiliate ID: ${affiliate.id}`,
    });
    return;
  }

  try {
    const funnel = getReferralFunnel(affiliateId);
    res.json({
      success: true,
      funnel,
    });
  } catch (error) {
    console.error('[Referral Funnel] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get referral funnel',
    });
  }
});

export default router;
