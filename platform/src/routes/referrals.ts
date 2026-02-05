import { Router, Request, Response } from 'express';
import {
  getAffiliate,
  createReferral,
  getAffiliateReferrals,
  getReferralFunnel,
} from '../db';

const router = Router();

// Simulate a referral link click (GET /api/referral/:affiliateId)
// This is what happens when a user visits venice.ai/?ref=aff_XXXX
router.get('/referral/:affiliateId', (req: Request, res: Response) => {
  const { affiliateId } = req.params;

  const affiliate = getAffiliate(affiliateId);
  if (!affiliate) {
    res.status(404).json({
      success: false,
      message: 'Invalid referral code',
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
      message: 'Failed to track referral',
    });
  }
});

// Get all referrals for an affiliate
router.get('/referrals/:affiliateId', (req: Request, res: Response) => {
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
      message: 'Failed to get referrals',
    });
  }
});

// Get referral funnel stats for an affiliate
router.get('/referrals/:affiliateId/funnel', (req: Request, res: Response) => {
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
    const funnel = getReferralFunnel(affiliateId);
    res.json({
      success: true,
      funnel,
    });
  } catch (error) {
    console.error('[Referral Funnel] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get referral funnel',
    });
  }
});

export default router;
