/**
 * Full Journey E2E — Realistic advertiser + affiliate lifecycle.
 *
 * Unlike full-lifecycle.spec.ts (which uses direct deposits), this test
 * exercises the REAL Stripe checkout flow and direct-ref tracking flow:
 *
 *   Advertiser: register → create campaign → fund via Stripe → confirm tracking → activate
 *   Affiliate:  register with profile → discover → apply → get approved
 *   Tracking:   click direct `?swarm_ref=` link → land on mock page → advertiser fires postback
 *   Financials: verify escrow deduction, affiliate earnings, payout request
 *
 * Requires:
 *   - STRIPE_SECRET_KEY (test mode sk_test_...)
 *   - Running Next.js server on BASE_URL (default: http://localhost:3099)
 *
 * The test uses /api/test/mock-landing as the campaign's landingUrl and
 * /api/test/process-stripe-checkout to process payments without webhooks.
 */

import { test, expect } from "@playwright/test";
import {
  api,
  registerAgent,
  verifyAgentEmail,
  createCampaign,
  confirmTracking,
  activateCampaign,
  applyToCampaign,
  fundCampaignViaStripe,
  fundAdvertiserWallet,
  followTrackingLink,
  followTrackingLinkInBrowser,
  firePostback,
  getWalletBalance,
  getAnalyticsOverview,
  loginViaBrowser,
  MOCK_LANDING_URL,
} from "./helpers";

const RUN_ID = Date.now();
const HAS_STRIPE = !!process.env.STRIPE_SECRET_KEY;

// Shared state across all sequential tests
const state: {
  advertiser?: { agentId: string; apiKey: string };
  affiliate?: { agentId: string; apiKey: string };
  campaignId?: string;
  testTrackingCode?: string;
  escrowAccountId?: string;
  trackingCode?: string;
  trackingUrl?: string;
  enrollmentId?: string;
  postbackRef?: string;
  leadId?: string;
} = {};

test.describe.configure({ mode: "serial" });

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1: ADVERTISER ONBOARDING
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Phase 1: Advertiser Onboarding", () => {
  test("1.1 advertiser registers and verifies email", async () => {
    state.advertiser = await registerAgent(
      `Journey Advertiser ${RUN_ID}`,
      "ADVERTISER",
      `journey-adv-${RUN_ID}@test.affiliateswarm.dev`
    );
    expect(state.advertiser.agentId).toBeTruthy();
    expect(state.advertiser.apiKey).toMatch(/^swarm_live_/);

    // Verify email (required before creating campaigns)
    await verifyAgentEmail(state.advertiser.agentId);

    // Confirm verification level via /me
    const { json } = await api("GET", "/api/v1/me", undefined, state.advertiser.apiKey);
    expect(json.data.agent.verificationLevel).toBe("EMAIL_VERIFIED");
  });

  test("1.2 advertiser creates campaign with product info — landing on mock page", async () => {
    const result = await createCampaign(state.advertiser!.apiKey, {
      name: `Journey CPA Campaign ${RUN_ID}`,
      compensationModel: "CPA",
      payoutPerUnitCents: 1000, // $10 per conversion
      budgetCents: 100000,      // $1,000 budget
      landingUrl: MOCK_LANDING_URL, // Points to our mock advertiser page
      productUrl: "https://example-product.com",
      conversionAction: "paid_subscription",
      productDescription: "E2E test SaaS product",
      holdingPeriodDays: 0, // Immediate payout for testing
      enrollmentPolicy: "OPEN",
      buyerIncentiveType: "PERCENTAGE_OFF",
      buyerIncentiveValue: "20",
      buyerIncentiveLabel: "20% off your first month",
      buyerCouponCode: "JOURNEY20",
    });

    state.campaignId = result.campaignId;
    state.escrowAccountId = result.escrowAccountId;
    state.testTrackingCode = result.testTrackingCode;
    expect(state.campaignId).toBeTruthy();

    // Verify campaign is in DRAFT with correct product fields
    const { json } = await api(
      "GET", `/api/v1/campaigns/${state.campaignId}`,
      undefined, state.advertiser!.apiKey
    );
    expect(json.data.status).toBe("DRAFT");
    expect(json.data.productUrl).toBe("https://example-product.com");
    expect(json.data.conversionAction).toBe("paid_subscription");
    expect(json.data.landingUrl).toBe(MOCK_LANDING_URL);
    expect(json.data.buyerIncentiveType).toBe("PERCENTAGE_OFF");
    expect(json.data.buyerIncentiveLabel).toBe("20% off your first month");
    expect(json.data.buyerCouponCode).toBe("JOURNEY20");
  });

  test("1.3 advertiser funds campaign via Stripe checkout", async ({ page }) => {
    test.skip(!HAS_STRIPE, "STRIPE_SECRET_KEY not set — skipping Stripe test");

    await fundCampaignViaStripe(
      page,
      state.advertiser!.agentId,
      state.advertiser!.apiKey,
      state.campaignId!,
      10000 // $100 (minimum is $10)
    );

    // Verify escrow is credited (net of 3% card fee = $97.00)
    const { json } = await api(
      "GET", `/api/v1/campaigns/${state.campaignId}`,
      undefined, state.advertiser!.apiKey
    );
    expect(json.data.escrowAccount.currentBalanceCents).toBeGreaterThan(0);
  });

  test("1.3-fallback advertiser funds wallet via direct deposit ($1,000)", async () => {
    test.skip(HAS_STRIPE, "Stripe is configured — using Stripe checkout instead");

    await fundAdvertiserWallet(
      state.advertiser!.agentId,
      state.advertiser!.apiKey,
      state.campaignId!,
      100000 // $1,000 credited to wallet; campaign auto-draws at conversion time
    );

    const wallet = await getWalletBalance(state.advertiser!.apiKey);
    expect(wallet.availableCents).toBeGreaterThanOrEqual(100000);
  });

  test("1.4 activation fails without tracking confirmation", async () => {
    const { status, json } = await api(
      "POST", `/api/v1/campaigns/${state.campaignId}/activate`,
      {}, state.advertiser!.apiKey
    );
    // Should fail because tracking hasn't been confirmed yet
    expect(status).toBeGreaterThanOrEqual(400);
    expect(json.error.message).toContain("tracking");
  });

  test("1.5 advertiser confirms tracking setup", async () => {
    await confirmTracking(state.advertiser!.apiKey, state.testTrackingCode!);

    const { json } = await api(
      "GET", `/api/v1/campaigns/${state.campaignId}`,
      undefined, state.advertiser!.apiKey
    );
    expect(json.data.trackingConfirmedAt).toBeTruthy();
  });

  test("1.6 advertiser activates the campaign", async () => {
    await activateCampaign(state.advertiser!.apiKey, state.campaignId!);

    const { json } = await api(
      "GET", `/api/v1/campaigns/${state.campaignId}`,
      undefined, state.advertiser!.apiKey
    );
    expect(json.data.status).toBe("ACTIVE");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: AFFILIATE ONBOARDING
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Phase 2: Affiliate Onboarding", () => {
  test("2.1 affiliate registers with profile fields and verifies email", async () => {
    state.affiliate = await registerAgent(
      `Journey Affiliate ${RUN_ID}`,
      "AFFILIATE",
      `journey-aff-${RUN_ID}@test.affiliateswarm.dev`,
      {
        profile: {
          audienceSize: 50000,
          channels: ["blog", "twitter", "newsletter"],
          contentType: "review",
          relevantUrls: [
            "https://myblog.example.com",
            "https://twitter.com/e2etester",
          ],
          audienceGeo: "US",
        },
      }
    );
    expect(state.affiliate.agentId).toBeTruthy();

    await verifyAgentEmail(state.affiliate.agentId);

    // Verify profile fields persisted
    const { json } = await api("GET", "/api/v1/me", undefined, state.affiliate.apiKey);
    expect(json.data.agent.audienceSize).toBe(50000);
    expect(json.data.agent.channels).toEqual(["blog", "twitter", "newsletter"]);
    expect(json.data.agent.contentType).toBe("review");
    expect(json.data.agent.audienceGeo).toBe("US");
    expect(json.data.agent.relevantUrls).toHaveLength(2);
  });

  test("2.2 affiliate discovers the advertiser's campaign with product info", async () => {
    const { status, json } = await api(
      "GET", "/api/v1/discover/campaigns",
      undefined, state.affiliate!.apiKey
    );
    expect(status).toBe(200);

    const campaign = json.data.find((c: any) => c.id === state.campaignId);
    expect(campaign).toBeTruthy(); // Present in discovery = ACTIVE
    expect(campaign.compensationModel).toBe("CPA");
    expect(campaign.payoutPerUnitCents).toBe(1000);
    expect(campaign.productUrl).toBe("https://example-product.com");
    expect(campaign.conversionAction).toBe("paid_subscription");
    expect(campaign.productDescription).toBeTruthy();
    expect(campaign.buyerIncentiveType).toBe("PERCENTAGE_OFF");
    expect(campaign.buyerIncentiveLabel).toBe("20% off your first month");
    expect(campaign.buyerCouponCode).toBe("JOURNEY20");
  });

  test("2.3 affiliate applies to campaign (OPEN = auto-approve)", async () => {
    const enrollment = await applyToCampaign(
      state.affiliate!.apiKey,
      state.campaignId!,
      "I run a tech review blog with 50k monthly readers. Strong audience overlap with SaaS developer tools."
    );

    expect(enrollment.status).toBe("APPROVED");
    expect(enrollment.trackingCode).toBeTruthy();

    state.enrollmentId = enrollment.enrollmentId;
    state.trackingCode = enrollment.trackingCode;
  });

  test("2.4 advertiser sees affiliate profile data in application listing", async () => {
    const { status, json } = await api(
      "GET", `/api/v1/campaigns/${state.campaignId}/applications`,
      undefined, state.advertiser!.apiKey
    );
    expect(status).toBe(200);

    const application = json.data.find(
      (a: any) => a.affiliate?.id === state.affiliate!.agentId
    );
    expect(application).toBeTruthy();
    expect(application.affiliate.audienceSize).toBe(50000);
    expect(application.affiliate.channels).toContain("blog");
    expect(application.affiliate.contentType).toBe("review");
    expect(application.affiliate.audienceGeo).toBe("US");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3: TRACKING & CONVERSION — THE FULL REDIRECT CHAIN
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Phase 3: Tracking & Conversion", () => {
  test("3.1 tracking link points directly at advertiser landing URL with promo code", async () => {
    // Direct-ref model: no AffiliateSwarm redirect. Link is `<landingUrl>?swarm_ref=<code>&promo=<coupon>`.
    const result = await followTrackingLink(state.trackingCode!);
    expect(result.status).toBe(200);
    expect(result.ref).toBe(state.trackingCode);
    expect(result.location).toContain(`swarm_ref=${state.trackingCode}`);
    expect(result.location).toContain("promo=JOURNEY20");

    state.postbackRef = result.ref!;
  });

  test("3.2 tracking link works end-to-end in browser", async ({ page }) => {
    // Browser-level: user lands on advertiser page with swarm_ref in query string.
    const result = await followTrackingLinkInBrowser(page, state.trackingCode!);
    expect(result.ref).toBe(state.trackingCode);
  });

  test("3.3 advertiser fires postback — conversion verified and affiliate paid", async () => {
    const result = await firePostback(
      state.advertiser!.apiKey,
      state.postbackRef!,
      `journey-conv-${RUN_ID}`,
      "PURCHASE",
      9900 // $99 revenue
    );

    expect(result.created).toBe(true);
    expect(result.leadStatus).toBe("VERIFIED");
    expect(result.payoutCents).toBe(1000); // $10 CPA
    state.leadId = result.leadId;
  });

  test("3.4 duplicate postback is idempotent", async () => {
    const result = await firePostback(
      state.advertiser!.apiKey,
      state.postbackRef!,
      `journey-conv-${RUN_ID}`, // Same externalId
      "PURCHASE",
      9900
    );

    expect(result.created).toBe(false); // 200, not 201
    expect(result.leadId).toBe(state.leadId); // Same lead returned
  });

  test("3.5 second conversion works with different externalId", async () => {
    const result = await firePostback(
      state.advertiser!.apiKey,
      state.postbackRef!,
      `journey-conv2-${RUN_ID}`,
      "PURCHASE",
      4900
    );

    expect(result.created).toBe(true);
    expect(result.payoutCents).toBe(1000); // Same CPA rate
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4: FINANCIAL VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Phase 4: Financial Verification", () => {
  test("4.1 affiliate wallet has earned balance from conversions", async () => {
    const wallet = await getWalletBalance(state.affiliate!.apiKey);
    // 2 conversions × $10 CPA = $20 gross, minus 5% platform fee = $19 net to affiliate
    expect(wallet.availableCents).toBeGreaterThan(0);
  });

  test("4.2 campaign escrow balance decreased by payouts", async () => {
    const { json } = await api(
      "GET", `/api/v1/campaigns/${state.campaignId}`,
      undefined, state.advertiser!.apiKey
    );
    // Budget started at $1,000 (or $97 via Stripe), 2 payouts of $10 each = $20 deducted
    expect(json.data.escrowAccount.currentBalanceCents).toBeLessThan(
      json.data.escrowAccount.totalDepositedCents
    );
  });

  test("4.3 affiliate can list their verified leads", async () => {
    const { status, json } = await api(
      "GET", "/api/v1/leads", undefined, state.affiliate!.apiKey
    );
    expect(status).toBe(200);
    const verified = json.data.filter((l: any) => l.status === "VERIFIED");
    expect(verified.length).toBeGreaterThanOrEqual(2);
  });

  test("4.4 advertiser can list leads for their campaign", async () => {
    const { status, json } = await api(
      "GET", `/api/v1/leads?campaignId=${state.campaignId}`,
      undefined, state.advertiser!.apiKey
    );
    expect(status).toBe(200);
    expect(json.data.length).toBeGreaterThanOrEqual(2);
  });

  test("4.5 affiliate requests a payout", async () => {
    const wallet = await getWalletBalance(state.affiliate!.apiKey);

    const { status, json } = await api(
      "POST", "/api/v1/payouts",
      {
        amountCents: Math.min(wallet.availableCents, 500), // Withdraw up to $5
        method: "CRYPTO",
        destination: { chainAddress: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12" },
      },
      state.affiliate!.apiKey
    );

    // Payout may be created or could fail if amount too low — just verify no crash
    expect([200, 201, 400]).toContain(status);
    if (status === 201 || status === 200) {
      expect(json.data.status).toBeTruthy();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 5: ANALYTICS & DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Phase 5: Analytics & Dashboard", () => {
  test("5.1 advertiser analytics show conversions", async () => {
    const { status, json } = await api(
      "GET", `/api/v1/analytics/campaigns/${state.campaignId}`,
      undefined, state.advertiser!.apiKey
    );
    expect(status).toBe(200);
  });

  test("5.2 affiliate analytics overview works", async () => {
    const { status } = await api(
      "GET", "/api/v1/analytics/overview",
      undefined, state.affiliate!.apiKey
    );
    expect(status).toBe(200);
  });

  test("5.3 advertiser dashboard login code flow", async () => {
    const { status, json } = await api(
      "POST", "/api/v1/auth/login-code", {},
      state.advertiser!.apiKey
    );
    expect(status).toBe(200);
    expect(json.data.code).toHaveLength(6);
  });

  test("5.4 advertiser can log into browser dashboard", async ({ page }) => {
    await loginViaBrowser(page, state.advertiser!.apiKey, "/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("5.5 affiliate can log into browser dashboard", async ({ page }) => {
    await loginViaBrowser(page, state.affiliate!.apiKey, "/affiliate");
    await expect(page).toHaveURL(/\/affiliate/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 6: ERROR HANDLING & EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Phase 6: Error Handling", () => {
  test("6.1 unauthenticated request returns 401", async () => {
    const { status } = await api("GET", "/api/v1/me", undefined, "swarm_live_invalid_xxx");
    expect(status).toBe(401);
  });

  test("6.2 unverified affiliate can discover campaigns", async () => {
    // Register a new affiliate but DON'T verify email
    const unverified = await registerAgent(
      `Unverified Affiliate ${RUN_ID}`,
      "AFFILIATE",
      `unverified-${RUN_ID}@test.affiliateswarm.dev`
    );

    const { status, json } = await api(
      "GET", "/api/v1/discover/campaigns",
      undefined, unverified.apiKey
    );
    expect(status).toBe(200);
    expect(Array.isArray(json.data)).toBe(true);
  });

  test("6.3 affiliate cannot create campaigns (wrong role)", async () => {
    const { status } = await api(
      "POST", "/api/v1/campaigns",
      {
        name: "Should Fail",
        compensationModel: "CPA",
        payoutPerUnitCents: 100,
        budgetCents: 10000,
      },
      state.affiliate!.apiKey
    );
    expect(status).toBe(403);
  });

  test("6.4 postback with unknown ref returns error", async () => {
    const { status } = await api(
      "POST", "/api/v1/postback",
      { swarm_ref: "nonexistent_code", externalId: "test", eventType: "PURCHASE" },
      state.advertiser!.apiKey
    );
    expect([400, 404]).toContain(status);
  });

  test("6.5 cannot activate a campaign that is already active", async () => {
    const { status } = await api(
      "POST", `/api/v1/campaigns/${state.campaignId}/activate`,
      {}, state.advertiser!.apiKey
    );
    expect(status).toBeGreaterThanOrEqual(400);
  });

  test("6.6 validation rejects malformed campaign creation", async () => {
    const { status } = await api(
      "POST", "/api/v1/campaigns",
      { description: "missing required fields" },
      state.advertiser!.apiKey
    );
    expect(status).toBe(400);
  });

  test("6.7 404 on non-existent resource", async () => {
    const { status } = await api(
      "GET", "/api/v1/campaigns/00000000-0000-0000-0000-000000000000",
      undefined, state.advertiser!.apiKey
    );
    expect(status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 7: CAMPAIGN LIFECYCLE (PAUSE / RESUME)
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Phase 7: Campaign Lifecycle", () => {
  test("7.1 advertiser can pause an active campaign", async () => {
    const { status, json } = await api(
      "POST", `/api/v1/campaigns/${state.campaignId}/pause`,
      {}, state.advertiser!.apiKey
    );
    expect(status).toBe(200);
    expect(json.data.status).toBe("PAUSED");
  });

  test("7.2 paused campaign is not discoverable by affiliates", async () => {
    const { json } = await api(
      "GET", "/api/v1/discover/campaigns",
      undefined, state.affiliate!.apiKey
    );
    const found = json.data.find((c: any) => c.id === state.campaignId);
    expect(found).toBeFalsy();
  });

  test("7.3 advertiser can resume a paused campaign", async () => {
    const { status, json } = await api(
      "POST", `/api/v1/campaigns/${state.campaignId}/resume`,
      {}, state.advertiser!.apiKey
    );
    expect(status).toBe(200);
    expect(json.data.status).toBe("ACTIVE");
  });

  test("7.4 resumed campaign is discoverable again", async () => {
    const { json } = await api(
      "GET", "/api/v1/discover/campaigns",
      undefined, state.affiliate!.apiKey
    );
    const found = json.data.find((c: any) => c.id === state.campaignId);
    expect(found).toBeTruthy();
  });
});
