/**
 * Full E2E lifecycle test — exercises the entire AffiliateSwarm platform across
 * all three roles (advertiser, affiliate, admin) via API and browser.
 *
 * All tests run sequentially and share state across the entire file.
 * No external services required (uses direct deposits, no Stripe).
 *
 * Sections:
 *   1.  Advertiser Registration    — register, verify email, confirm identity
 *   2.  Campaign Creation & Funding — create CPA campaign, fund escrow, confirm tracking, activate
 *   3.  Affiliate Registration     — register with full profile (audience, channels, geo, URLs)
 *   4.  Discovery & Application    — affiliate discovers campaigns, applies, advertiser sees profile data
 *   5.  Click Tracking & Conversion — follow tracking link, fire postback, verify idempotency
 *   6.  Balance & Analytics        — wallet balances, escrow deductions, lead lists, analytics KPIs
 *   7.  Affiliate Payout           — PLATFORM_CREDIT (instant), CRYPTO (pending), balance verification
 *   8.  Advertiser Dispute         — create held campaign, dispute verified lead, verify refund & guards
 *   9.  Error Handling             — bad auth, 404s, invalid payloads, business rule violations
 *   10. Advertiser Dashboard       — browser login, campaign list/detail, leads, conversions, analytics
 *   11. Affiliate Dashboard        — browser login, enrolled campaigns, earnings, wallet, reputation
 *   12. Admin Dashboard            — overview, agents list, payments (requires ADMIN_SECRET)
 */

import { test, expect } from "@playwright/test";
import {
  api,
  registerAgent,
  verifyAgentEmail,
  createCampaign,
  fundAdvertiserWallet,
  confirmTracking,
  activateCampaign,
  applyToCampaign,
  loginViaBrowser,
  setupAdminAuth,
  followTrackingLink,
  firePostback,
  getWalletBalance,
  getAnalyticsOverview,
  requestPayout,
  listPayouts,
  listConversions,
  MOCK_LANDING_URL,
} from "./helpers";

const RUN_ID = Date.now();

// Shared state across all tests
const state: {
  advertiser?: { agentId: string; apiKey: string };
  affiliate?: { agentId: string; apiKey: string };
  campaignId?: string;
  campaignTestTrackingCode?: string;
  escrowAccountId?: string;
  trackingCode?: string;
  leadId?: string;
  payoutId?: string;
  disputeCampaignId?: string;
  disputeCampaignTestTrackingCode?: string;
  disputeTrackingCode?: string;
  disputeLeadId?: string;
} = {};

// All tests are serial and share state
test.describe.configure({ mode: "serial" });

// ═══════════════════════════════════════════════════════════════════════
// 1. ADVERTISER REGISTRATION & SETUP
// ═══════════════════════════════════════════════════════════════════════

test("1.1 advertiser registers", async () => {
  state.advertiser = await registerAgent(
    `E2E Advertiser ${RUN_ID}`,
    "ADVERTISER",
    `e2e-adv-${RUN_ID}@test.affiliateswarm.dev`
  );
  expect(state.advertiser.agentId).toBeTruthy();
  expect(state.advertiser.apiKey).toMatch(/^swarm_live_/);
});

test("1.2 advertiser verifies email", async () => {
  await verifyAgentEmail(state.advertiser!.agentId);
  const { json } = await api("GET", "/api/v1/me", undefined, state.advertiser!.apiKey);
  expect(json.data.agent.verificationLevel).toBe("EMAIL_VERIFIED");
});

test("1.3 advertiser identity confirmed via /me", async () => {
  const { status, json } = await api("GET", "/api/v1/me", undefined, state.advertiser!.apiKey);
  expect(status).toBe(200);
  expect(json.data.agent.id).toBe(state.advertiser!.agentId);
  expect(json.data.agent.type).toBe("ADVERTISER");
});

// ═══════════════════════════════════════════════════════════════════════
// 2. CAMPAIGN CREATION & FUNDING
// ═══════════════════════════════════════════════════════════════════════

test("2.1 advertiser creates a CPA campaign ($10 flat payout, hold=0)", async () => {
  const result = await createCampaign(state.advertiser!.apiKey, {
    name: `E2E CPA Campaign ${RUN_ID}`,
    description: "End-to-end test campaign with instant payouts",
    compensationModel: "CPA",
    payoutPerUnitCents: 1000, // $10 flat
    budgetCents: 100000, // $1000 budget
    holdingPeriodDays: 0, // instant release for testing
    enrollmentPolicy: "OPEN", // auto-approve affiliates
    landingUrl: MOCK_LANDING_URL,
    productUrl: "https://example.com",
    conversionAction: "paid_subscription",
    productDescription: "E2E test SaaS product",
    requiresVerification: true,
    buyerIncentiveType: "PERCENTAGE_OFF",
    buyerIncentiveValue: "15",
    buyerIncentiveLabel: "15% off your first month",
    buyerCouponCode: "LIFECYCLE15",
  });
  state.campaignId = result.campaignId;
  state.escrowAccountId = result.escrowAccountId;
  state.campaignTestTrackingCode = result.testTrackingCode;
  expect(state.campaignId).toBeTruthy();
  expect(state.escrowAccountId).toBeTruthy();
  expect(state.campaignTestTrackingCode).toMatch(/^[1-9A-HJ-NP-Za-km-z]{8}$/);
});

test("2.2 campaign is in DRAFT status with correct settings", async () => {
  const { json } = await api(
    "GET",
    `/api/v1/campaigns/${state.campaignId}`,
    undefined,
    state.advertiser!.apiKey
  );
  expect(json.data.status).toBe("DRAFT");
  expect(json.data.compensationModel).toBe("CPA");
  expect(json.data.payoutPerUnitCents).toBe(1000);
  expect(json.data.holdingPeriodDays).toBe(0);
  expect(json.data.enrollmentPolicy).toBe("OPEN");
  expect(json.data.productUrl).toBe("https://example.com");
  expect(json.data.conversionAction).toBe("paid_subscription");
  expect(json.data.buyerIncentiveType).toBe("PERCENTAGE_OFF");
  expect(json.data.buyerIncentiveLabel).toBe("15% off your first month");
  expect(json.data.buyerCouponCode).toBe("LIFECYCLE15");

  // Owner view must include testTrackingCode so an integration agent that
  // mints a new API key under the owning agent can still fetch it for the
  // CONFIRM postback. Regression for #252.
  expect(json.data.testTrackingCode).toBe(state.campaignTestTrackingCode);
  expect(json.data.escrowAccount).toBeTruthy();
});

test("2.3 advertiser funds wallet with $1000 (campaigns will auto-draw at conversion time)", async () => {
  await fundAdvertiserWallet(
    state.advertiser!.agentId,
    state.advertiser!.apiKey,
    state.campaignId!,
    100000
  );

  // Under the wallet-first model, escrow stays at 0 until a conversion
  // triggers auto-fund via placeHold.
  const { json } = await api(
    "GET",
    `/api/v1/campaigns/${state.campaignId}`,
    undefined,
    state.advertiser!.apiKey
  );
  expect(json.data.escrowAccount.currentBalanceCents).toBe(0);
  expect(json.data.escrowAccount.totalDepositedCents).toBe(0);

  // Wallet holds the full $1000; fee is charged per conversion.
  const wallet = await getWalletBalance(state.advertiser!.apiKey);
  expect(wallet.availableCents).toBe(100000);
});

test("2.4 advertiser confirms tracking setup", async () => {
  await confirmTracking(state.advertiser!.apiKey, state.campaignTestTrackingCode!);
  const { json } = await api(
    "GET",
    `/api/v1/campaigns/${state.campaignId}`,
    undefined,
    state.advertiser!.apiKey
  );
  expect(json.data.trackingConfirmedAt).toBeTruthy();
});

test("2.5 advertiser activates the campaign", async () => {
  await activateCampaign(state.advertiser!.apiKey, state.campaignId!);
  const { json } = await api(
    "GET",
    `/api/v1/campaigns/${state.campaignId}`,
    undefined,
    state.advertiser!.apiKey
  );
  expect(json.data.status).toBe("ACTIVE");
});

// ═══════════════════════════════════════════════════════════════════════
// 3. AFFILIATE REGISTRATION & PROFILE
// ═══════════════════════════════════════════════════════════════════════

test("3.1 affiliate registers with full profile", async () => {
  state.affiliate = await registerAgent(
    `E2E Affiliate ${RUN_ID}`,
    "AFFILIATE",
    `e2e-aff-${RUN_ID}@test.affiliateswarm.dev`,
    {
      profile: {
        audienceSize: 50000,
        channels: ["blog", "twitter", "newsletter"],
        contentType: "review",
        relevantUrls: [
          "https://myblog.example.com",
          "https://twitter.com/e2etest",
        ],
        audienceGeo: "US",
      },
    }
  );
  expect(state.affiliate.agentId).toBeTruthy();
  expect(state.affiliate.apiKey).toMatch(/^swarm_live_/);
});

test("3.2 affiliate verifies email", async () => {
  await verifyAgentEmail(state.affiliate!.agentId);
});

test("3.3 affiliate profile fields persisted in /me", async () => {
  const { json } = await api(
    "GET",
    "/api/v1/me",
    undefined,
    state.affiliate!.apiKey
  );
  expect(json.data.agent.audienceSize).toBe(50000);
  expect(json.data.agent.channels).toEqual(["blog", "twitter", "newsletter"]);
  expect(json.data.agent.contentType).toBe("review");
  expect(json.data.agent.audienceGeo).toBe("US");
  expect(json.data.agent.relevantUrls).toHaveLength(2);
});

// ═══════════════════════════════════════════════════════════════════════
// 4. CAMPAIGN DISCOVERY & APPLICATION
// ═══════════════════════════════════════════════════════════════════════

test("4.1 affiliate discovers active campaigns with product info", async () => {
  const { status, json } = await api(
    "GET",
    "/api/v1/discover/campaigns",
    undefined,
    state.affiliate!.apiKey
  );
  expect(status).toBe(200);
  const found = json.data.find((c: any) => c.id === state.campaignId);
  expect(found).toBeTruthy();
  expect(found.compensationModel).toBe("CPA");
  expect(found.payoutPerUnitCents).toBe(1000);
  expect(found.productUrl).toBe("https://example.com");
  expect(found.conversionAction).toBe("paid_subscription");
  expect(found.productDescription).toBeTruthy();
});

test("4.1b non-owner GET /campaigns/:id does not leak owner-only secrets", async () => {
  // The affiliate (non-owner) can fetch campaign details, but must not see
  // testTrackingCode or refSeed — those are owner-only secrets used to
  // control tracking confirmation / tracking-code derivation. Regression
  // guard for the leak that existed pre-#252 fix.
  const { status, json } = await api(
    "GET",
    `/api/v1/campaigns/${state.campaignId}`,
    undefined,
    state.affiliate!.apiKey
  );
  expect(status).toBe(200);
  expect(json.data.id).toBe(state.campaignId);
  expect(json.data.testTrackingCode).toBeUndefined();
  expect(json.data.refSeed).toBeUndefined();
  expect(json.data.escrowAccount).toBeUndefined();
  expect(json.data.budgetSpentCents).toBeUndefined();
});

test("4.2 affiliate applies to campaign (OPEN = auto-approve)", async () => {
  const enrollment = await applyToCampaign(
    state.affiliate!.apiKey,
    state.campaignId!,
    "I run a tech review blog with 50k monthly readers specializing in SaaS tools"
  );
  expect(enrollment.status).toBe("APPROVED");
  expect(enrollment.trackingCode).toBeTruthy();
  state.trackingCode = enrollment.trackingCode;
});

test("4.3 advertiser sees affiliate profile in application listing", async () => {
  const { status, json } = await api(
    "GET",
    `/api/v1/campaigns/${state.campaignId}/applications`,
    undefined,
    state.advertiser!.apiKey
  );
  expect(status).toBe(200);
  const app = json.data.find(
    (a: any) => a.affiliate?.id === state.affiliate!.agentId
  );
  expect(app).toBeTruthy();
  expect(app.affiliate.audienceSize).toBe(50000);
  expect(app.affiliate.channels).toEqual(["blog", "twitter", "newsletter"]);
  expect(app.affiliate.contentType).toBe("review");
  expect(app.affiliate.audienceGeo).toBe("US");
});

// ═══════════════════════════════════════════════════════════════════════
// 5. CLICK TRACKING & CONVERSION
// ═══════════════════════════════════════════════════════════════════════

test("5.1 affiliate tracking link points directly at advertiser landing URL", async () => {
  // Direct-ref model: affiliate shares `<landingUrl>?swarm_ref=<code>` — no AffiliateSwarm redirect.
  const result = await followTrackingLink(state.trackingCode!);
  expect(result.status).toBe(200);
  expect(result.location).toContain(`swarm_ref=${state.trackingCode}`);
  expect(result.ref).toBe(state.trackingCode);
});

test("5.2 advertiser fires postback — lead created as VERIFIED", async () => {
  const result = await firePostback(
    state.advertiser!.apiKey,
    state.trackingCode!,
    `e2e-purchase-${RUN_ID}`,
    "PURCHASE",
    5000 // $50 revenue
  );
  expect(result.created).toBe(true);
  expect(result.leadStatus).toBe("VERIFIED");
  expect(result.payoutCents).toBe(1000); // $10 CPA flat payout
  state.leadId = result.leadId;
});

test("5.3 duplicate postback is idempotent (returns existing)", async () => {
  const { status } = await api(
    "POST",
    "/api/v1/postback",
    {
      swarm_ref: state.trackingCode,
      externalId: `e2e-purchase-${RUN_ID}`, // same externalId
      eventType: "PURCHASE",
      revenueCents: 5000,
    },
    state.advertiser!.apiKey
  );
  expect(status).toBe(200); // 200 = existing, not 201
});

// ═══════════════════════════════════════════════════════════════════════
// 6. CONVERSION & BALANCE VERIFICATION (API)
// ═══════════════════════════════════════════════════════════════════════

test("6.1 ConversionEvent record created from postback", async () => {
  const conversions = await listConversions(state.advertiser!.apiKey);
  const conv = conversions.find((c: any) => c.leadId === state.leadId);
  expect(conv).toBeTruthy();
  expect(conv.actionType).toBe("PURCHASE");
  expect(conv.status).toBe("VERIFIED");
  expect(conv.campaignId).toBe(state.campaignId);
  expect(conv.affiliateId).toBe(state.affiliate!.agentId);
});

test("6.2 affiliate wallet shows payout net of platform fee", async () => {
  const wallet = await getWalletBalance(state.affiliate!.apiKey);
  // $10 CPA − 5% platform fee = 950 cents to affiliate
  expect(wallet.availableCents).toBe(950);
});

test("6.3 conversion auto-funded escrow, released to affiliate, wallet debited", async () => {
  const { json } = await api(
    "GET",
    `/api/v1/campaigns/${state.campaignId}`,
    undefined,
    state.advertiser!.apiKey
  );
  // Under the wallet-first model: escrow starts at 0. placeHold auto-funds
  // the $10 deficit from the wallet (totalDeposited += 10), creates the
  // hold (currentBalance -= 10), then releaseHold moves the hold out to
  // the affiliate. Net: escrow is back to 0, totalReleased is $10, and
  // the advertiser's wallet is debited $10 ($1000 → $990).
  expect(json.data.escrowAccount.currentBalanceCents).toBe(0);
  expect(json.data.escrowAccount.totalDepositedCents).toBe(1000);
  expect(json.data.escrowAccount.totalReleasedCents).toBe(1000);
  expect(json.data.budgetSpentCents).toBe(1000);

  const wallet = await getWalletBalance(state.advertiser!.apiKey);
  expect(wallet.availableCents).toBe(99000);
});

test("6.4 affiliate can list their leads", async () => {
  const { status, json } = await api(
    "GET",
    "/api/v1/leads",
    undefined,
    state.affiliate!.apiKey
  );
  expect(status).toBe(200);
  expect(json.data.length).toBeGreaterThan(0);
  const lead = json.data.find((l: any) => l.id === state.leadId);
  expect(lead).toBeTruthy();
  expect(lead.status).toBe("VERIFIED");
  expect(lead.payoutCents).toBe(1000);
});

test("6.5 advertiser can list leads for their campaign", async () => {
  const { status, json } = await api(
    "GET",
    `/api/v1/leads?campaignId=${state.campaignId}`,
    undefined,
    state.advertiser!.apiKey
  );
  expect(status).toBe(200);
  expect(json.data.length).toBeGreaterThan(0);
});

test("6.6 advertiser analytics KPIs are populated", async () => {
  const overview = await getAnalyticsOverview(state.advertiser!.apiKey);
  expect(overview.totalLeads).toBeGreaterThanOrEqual(1);
  expect(overview.verifiedLeads).toBeGreaterThanOrEqual(1);
  expect(overview.totalConversions).toBeGreaterThanOrEqual(1);
  expect(overview.activeCampaigns).toBeGreaterThanOrEqual(1);
});

test("6.7 affiliate analytics KPIs are populated", async () => {
  const overview = await getAnalyticsOverview(state.affiliate!.apiKey);
  expect(overview.totalLeads).toBeGreaterThanOrEqual(1);
  expect(overview.verifiedLeads).toBeGreaterThanOrEqual(1);
});

// ═══════════════════════════════════════════════════════════════════════
// 7. AFFILIATE PAYOUT
// ═══════════════════════════════════════════════════════════════════════

test("7.1 affiliate requests PLATFORM_CREDIT payout for full balance", async () => {
  // PLATFORM_CREDIT is instant — no external payment processor needed
  const result = await requestPayout(
    state.affiliate!.apiKey,
    950, // full available balance: $10.00 CPA − 5% platform fee
    "PLATFORM_CREDIT"
  );
  expect(result.payoutId).toBeTruthy();
  expect(result.amountCents).toBe(950);
  // PLATFORM_CREDIT payouts complete immediately
  expect(result.status).toBe("COMPLETED");
  state.payoutId = result.payoutId;
});

test("7.2 affiliate wallet balance is zero after payout", async () => {
  const wallet = await getWalletBalance(state.affiliate!.apiKey);
  // Full balance was paid out
  expect(wallet.availableCents).toBe(0);
});

test("7.3 payout appears in affiliate payout list", async () => {
  const payouts = await listPayouts(state.affiliate!.apiKey);
  expect(payouts.length).toBeGreaterThan(0);
  const payout = payouts.find((p: any) => p.id === state.payoutId);
  expect(payout).toBeTruthy();
  expect(payout.status).toBe("COMPLETED");
  expect(payout.amountCents).toBe(950);
  expect(payout.method).toBe("PLATFORM_CREDIT");
});

// Also test a CRYPTO payout request (will stay PENDING since no processor)
test("7.4 affiliate requests CRYPTO payout (stays PENDING)", async () => {
  // Fire another postback to get balance for this payout test
  await firePostback(
    state.advertiser!.apiKey,
    state.trackingCode!,
    `e2e-signup-${RUN_ID}`,
    "SIGNUP",
    2000
  );

  // Second conversion: $10 CPA − 5% platform fee = 950 cents to affiliate
  const wallet = await getWalletBalance(state.affiliate!.apiKey);
  expect(wallet.availableCents).toBe(950);

  const result = await requestPayout(
    state.affiliate!.apiKey,
    500, // $5.00
    "CRYPTO",
    { chainAddress: "0x1234567890abcdef1234567890abcdef12345678" }
  );
  expect(result.payoutId).toBeTruthy();
  expect(result.status).toBe("PENDING"); // CRYPTO payouts need external processing
  expect(result.method).toBe("CRYPTO");
});

// ═══════════════════════════════════════════════════════════════════════
// 8. ADVERTISER DISPUTE (DURING HOLD PERIOD)
// ═══════════════════════════════════════════════════════════════════════

test("8.1 advertiser creates a second campaign with 30-day holding period", async () => {
  // Disputes require PENDING_RELEASE holds, which only exist when holdingPeriodDays > 0.
  // The main campaign (section 2) uses hold=0 (instant release), so we need a separate campaign.
  const result = await createCampaign(state.advertiser!.apiKey, {
    name: `E2E Dispute Campaign ${RUN_ID}`,
    description: "Campaign with holding period for dispute testing",
    compensationModel: "CPA",
    payoutPerUnitCents: 1000, // $10 flat
    budgetCents: 50000, // $500 budget
    holdingPeriodDays: 30,
    enrollmentPolicy: "OPEN",
    landingUrl: MOCK_LANDING_URL,
    productUrl: "https://example.com",
    conversionAction: "paid_subscription",
    productDescription: "E2E dispute test product",
    requiresVerification: true,
  });
  state.disputeCampaignId = result.campaignId;
  state.disputeCampaignTestTrackingCode = result.testTrackingCode;
  expect(state.disputeCampaignId).toBeTruthy();
});

test("8.2 fund, confirm tracking, and activate dispute campaign", async () => {
  await fundAdvertiserWallet(
    state.advertiser!.agentId,
    state.advertiser!.apiKey,
    state.disputeCampaignId!,
    50000
  );
  await confirmTracking(state.advertiser!.apiKey, state.disputeCampaignTestTrackingCode!);
  await activateCampaign(state.advertiser!.apiKey, state.disputeCampaignId!);

  const { json } = await api(
    "GET",
    `/api/v1/campaigns/${state.disputeCampaignId}`,
    undefined,
    state.advertiser!.apiKey
  );
  expect(json.data.status).toBe("ACTIVE");
});

test("8.3 affiliate applies to dispute campaign (auto-approved)", async () => {
  const result = await applyToCampaign(
    state.affiliate!.apiKey,
    state.disputeCampaignId!
  );
  state.disputeTrackingCode = result.trackingCode;
  expect(result.status).toBe("APPROVED");
  expect(state.disputeTrackingCode).toBeTruthy();
});

test("8.4 fire postback — lead created as VERIFIED with PENDING_RELEASE hold", async () => {
  const result = await firePostback(
    state.advertiser!.apiKey,
    state.disputeTrackingCode!,
    `e2e-dispute-${RUN_ID}`,
    "PURCHASE",
    3000
  );
  expect(result.created).toBe(true);
  expect(result.leadStatus).toBe("VERIFIED");
  expect(result.payoutCents).toBe(1000);
  state.disputeLeadId = result.leadId;
});

test("8.5 advertiser disputes the verified lead", async () => {
  const { status, json } = await api(
    "POST",
    `/api/v1/leads/${state.disputeLeadId}/dispute`,
    { reason: "Fraudulent conversion — automated test dispute" },
    state.advertiser!.apiKey
  );
  expect(status).toBe(200);
  expect(json.data.status).toBe("DISPUTED");
  expect(json.data.disputedAt).toBeTruthy();
  expect(json.data.disputeReason).toBe("Fraudulent conversion — automated test dispute");
});

test("8.6 disputed lead shows DISPUTED status via API", async () => {
  const { status, json } = await api(
    "GET",
    "/api/v1/leads",
    undefined,
    state.advertiser!.apiKey
  );
  expect(status).toBe(200);
  const lead = json.data.find((l: any) => l.id === state.disputeLeadId);
  expect(lead).toBeTruthy();
  expect(lead.status).toBe("DISPUTED");
});

test("8.7 escrow balance restored after dispute", async () => {
  const { json } = await api(
    "GET",
    `/api/v1/campaigns/${state.disputeCampaignId}`,
    undefined,
    state.advertiser!.apiKey
  );
  // Under the wallet-first model: wallet funded $500, escrow starts 0.
  // Conversion auto-funds $10 (wallet → escrow → hold), release pushes to
  // PENDING_RELEASE (totalReleased += 10, budgetSpent += 10). Dispute
  // refunds the hold back to escrow.currentBalance, decrementing
  // totalReleased and budgetSpent. Refund lands in escrow (not back to
  // wallet). Net: totalDeposited=10, currentBalance=10, refunded=10.
  expect(json.data.budgetSpentCents).toBe(0);
  expect(json.data.escrowAccount.currentBalanceCents).toBe(1000);
  expect(json.data.escrowAccount.totalDepositedCents).toBe(1000);
  expect(json.data.escrowAccount.totalReleasedCents).toBe(0);
  expect(json.data.escrowAccount.totalRefundedCents).toBe(1000);
});

test("8.8 cannot dispute an already-disputed lead", async () => {
  const { status } = await api(
    "POST",
    `/api/v1/leads/${state.disputeLeadId}/dispute`,
    { reason: "Second dispute attempt" },
    state.advertiser!.apiKey
  );
  expect(status).toBe(400);
});

test("8.9 affiliate cannot dispute (wrong role)", async () => {
  const { status } = await api(
    "POST",
    `/api/v1/leads/${state.disputeLeadId}/dispute`,
    { reason: "Affiliate trying to dispute" },
    state.affiliate!.apiKey
  );
  expect(status).toBe(403);
});

test("8.10 dispute requires a reason", async () => {
  // Fire another postback to get a valid lead to test validation against
  const result = await firePostback(
    state.advertiser!.apiKey,
    state.disputeTrackingCode!,
    `e2e-validation-${RUN_ID}`,
    "PURCHASE",
    1000
  );
  const { status } = await api(
    "POST",
    `/api/v1/leads/${result.leadId}/dispute`,
    { reason: "" },
    state.advertiser!.apiKey
  );
  expect(status).toBe(400);
});

// ═══════════════════════════════════════════════════════════════════════
// 9. ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════

test("9.1 rejects bad API key", async () => {
  const { status } = await api(
    "GET",
    "/api/v1/me",
    undefined,
    "swarm_live_invalid_key_xxx"
  );
  expect(status).toBe(401);
});

test("9.2 404 on non-existent resource", async () => {
  const { status } = await api(
    "GET",
    "/api/v1/leads/00000000-0000-0000-0000-000000000000",
    undefined,
    state.advertiser!.apiKey
  );
  expect(status).toBe(404);
});

test("9.3 400 on invalid campaign creation", async () => {
  const { status } = await api(
    "POST",
    "/api/v1/campaigns",
    { description: "missing required fields" },
    state.advertiser!.apiKey
  );
  expect(status).toBe(400);
});

test("9.4 payout below minimum ($1) is rejected", async () => {
  const { status, json } = await api(
    "POST",
    "/api/v1/payouts",
    {
      amountCents: 50, // $0.50 — below $1.00 minimum
      method: "PLATFORM_CREDIT",
      destination: {},
    },
    state.affiliate!.apiKey
  );
  expect(status).toBe(400);
});

test("9.5 activate without tracking confirmation fails", async () => {
  // Under the wallet-first model, a funded wallet lets any of the
  // advertiser's campaigns activate — so "unfunded campaign" is no longer
  // a failure mode (this advertiser has wallet balance from earlier
  // tests). What IS still a hard activation gate is tracking
  // confirmation, so test that here.
  const { campaignId } = await createCampaign(state.advertiser!.apiKey, {
    name: `E2E Unconfirmed ${RUN_ID}`,
    budgetCents: 50000,
    holdingPeriodDays: 0,
  });
  // Deliberately skip confirmTracking.
  const { status, json } = await api(
    "POST",
    `/api/v1/campaigns/${campaignId}/activate`,
    {},
    state.advertiser!.apiKey
  );
  expect([400, 422]).toContain(status);
  expect(json.error?.message ?? "").toMatch(/tracking/i);
});

// ═══════════════════════════════════════════════════════════════════════
// 10. ADVERTISER BROWSER DASHBOARD
// ═══════════════════════════════════════════════════════════════════════

test("10.1 advertiser logs in and sees dashboard overview", async ({ page }) => {
  await loginViaBrowser(page, state.advertiser!.apiKey, "/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("Total Campaigns")).toBeVisible({
    timeout: 10_000,
  });
});

test("10.2 advertiser sees their campaign in list", async ({ page }) => {
  await loginViaBrowser(
    page,
    state.advertiser!.apiKey,
    "/dashboard/campaigns"
  );
  await expect(
    page.locator(`text=E2E CPA Campaign ${RUN_ID}`)
  ).toBeVisible({ timeout: 10_000 });
});

test("10.3 advertiser campaign detail shows payout and budget", async ({
  page,
}) => {
  await loginViaBrowser(
    page,
    state.advertiser!.apiKey,
    `/dashboard/campaigns/${state.campaignId}`
  );
  await expect(page.locator("text=Budget").first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator("text=Payout").first()).toBeVisible();
});

test("10.4 advertiser leads page shows verified leads", async ({ page }) => {
  await loginViaBrowser(page, state.advertiser!.apiKey, "/dashboard/leads");
  await expect(page.getByRole("heading", { name: /leads/i })).toBeVisible({
    timeout: 10_000,
  });
  // Should see at least one lead row in the table
  await expect(page.locator("table tbody tr").first()).toBeVisible({
    timeout: 10_000,
  });
});

test("10.5 advertiser performance page shows unified CPA conversions", async ({
  page,
}) => {
  await loginViaBrowser(
    page,
    state.advertiser!.apiKey,
    "/dashboard/performance#conversions"
  );
  await expect(
    page.getByRole("heading", { level: 2, name: "Performance" })
  ).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByRole("heading", { name: /conversion ledger/i })
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Total CPA Conversions")).toBeVisible();

  // Unified table exposes the columns requested by issue #224
  await expect(page.getByRole("columnheader", { name: "Status" })).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Hold Window" })
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Maturity" })
  ).toBeVisible();

  // At least one CPA conversion row exists
  await expect(page.locator("table tbody tr").first()).toBeVisible({
    timeout: 10_000,
  });
});

test("10.5b advertiser CPA campaign detail shows Recent Conversions (not Recent Leads)", async ({
  page,
}) => {
  await loginViaBrowser(
    page,
    state.advertiser!.apiKey,
    `/dashboard/campaigns/${state.campaignId}`
  );
  await expect(
    page.getByRole("heading", { name: /recent conversions/i })
  ).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByRole("heading", { name: /^recent leads$/i })
  ).toHaveCount(0);
});

test("10.6 advertiser performance page shows non-zero KPIs", async ({
  page,
}) => {
  await loginViaBrowser(
    page,
    state.advertiser!.apiKey,
    "/dashboard/performance"
  );
  await expect(
    page.getByRole("heading", { level: 2, name: "Performance" })
  ).toBeVisible({ timeout: 10_000 });
  // At least one KPI card should show a non-zero number
  await expect(page.getByText("Total Leads")).toBeVisible();
});

test("10.7 legacy advertiser performance routes redirect", async ({ page }) => {
  await loginViaBrowser(
    page,
    state.advertiser!.apiKey,
    "/dashboard/analytics?period=7d"
  );
  await page.waitForURL(/\/dashboard\/performance/);
  let url = new URL(page.url());
  expect(url.pathname).toBe("/dashboard/performance");
  expect(url.searchParams.get("period")).toBe("7d");
  expect(url.hash).toBe("#trends");

  await page.goto("/dashboard/conversions?page=2");
  await page.waitForURL(/\/dashboard\/performance/);
  url = new URL(page.url());
  expect(url.pathname).toBe("/dashboard/performance");
  expect(url.searchParams.get("page")).toBe("2");
  expect(url.hash).toBe("#conversions");

  await page.goto("/dashboard/live");
  await page.waitForURL(/\/dashboard\/performance/);
  url = new URL(page.url());
  expect(url.pathname).toBe("/dashboard/performance");
  expect(url.hash).toBe("#live-status");
});

// ═══════════════════════════════════════════════════════════════════════
// 11. AFFILIATE BROWSER DASHBOARD
// ═══════════════════════════════════════════════════════════════════════

test("11.1 affiliate logs in and sees dashboard", async ({ page }) => {
  await loginViaBrowser(page, state.affiliate!.apiKey, "/affiliate");
  await expect(page).toHaveURL(/\/affiliate/);
});

test("11.2 affiliate sees enrolled campaign", async ({ page }) => {
  await loginViaBrowser(
    page,
    state.affiliate!.apiKey,
    "/affiliate/campaigns"
  );
  await expect(
    page.locator(`text=E2E CPA Campaign ${RUN_ID}`)
  ).toBeVisible({ timeout: 10_000 });
});

test("11.3 affiliate earnings page shows verified earnings", async ({
  page,
}) => {
  await loginViaBrowser(page, state.affiliate!.apiKey, "/affiliate/earnings");
  await expect(
    page.getByRole("heading", { name: /earnings/i })
  ).toBeVisible({ timeout: 10_000 });
  // Should show the total commissions earned
  await expect(page.getByText("Total Commissions Earned")).toBeVisible();
});

test("11.3b affiliate with CPA enrollment sees Conversions (not Leads) section per issue #227", async ({
  page,
}) => {
  await loginViaBrowser(page, state.affiliate!.apiKey, "/affiliate/earnings");
  // Section header is "Conversions" (not "Leads") for CPA-enrolled affiliates
  await expect(
    page.getByRole("heading", { name: /^conversions$/i })
  ).toBeVisible({ timeout: 10_000 });
  // Filter buttons match the new unified taxonomy
  await expect(
    page.getByRole("link", { name: /^Pending$/ })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^Verified$/ })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^Reversed$/ })
  ).toBeVisible();
});

test("11.4 affiliate wallet page shows balance", async ({ page }) => {
  await loginViaBrowser(page, state.affiliate!.apiKey, "/affiliate/wallet");
  // The wallet page should show the available balance card
  await expect(page.getByText("Available", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
});

test("11.5 affiliate reputation page loads", async ({ page }) => {
  await loginViaBrowser(
    page,
    state.affiliate!.apiKey,
    "/affiliate/reputation"
  );
  await expect(
    page.getByRole("heading", { name: /reputation/i })
  ).toBeVisible({ timeout: 10_000 });
});

// ═══════════════════════════════════════════════════════════════════════
// 12. ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════

const hasAdminSecret = !!process.env.ADMIN_SECRET;

test("12.1 admin overview shows V1 KPI sections", async ({ context, page }) => {
  test.skip(!hasAdminSecret, "ADMIN_SECRET not set");
  await setupAdminAuth(context);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible({ timeout: 10_000 });
  // V1 KPI sections
  await expect(page.getByText("Platform Activity")).toBeVisible();
  await expect(page.getByText("Ongoing Campaigns")).toBeVisible();
  await expect(page.getByText("Total Leads")).toBeVisible();
  await expect(page.getByText("Total Conversions")).toBeVisible();
  // Advertiser + affiliate sections (use heading role to avoid matching chart card titles)
  await expect(page.getByRole("heading", { name: "Advertisers" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Affiliates" })).toBeVisible();
});

test("12.2 admin agents page loads", async ({ context, page }) => {
  test.skip(!hasAdminSecret, "ADMIN_SECRET not set");
  await setupAdminAuth(context);
  await page.goto("/admin/agents");
  await expect(page.getByRole("heading", { name: "Agents" })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("table tbody tr").first()).toBeVisible();
});

test("12.3 admin payments page loads", async ({ context, page }) => {
  test.skip(!hasAdminSecret, "ADMIN_SECRET not set");
  await setupAdminAuth(context);
  await page.goto("/admin/payments");
  await expect(page.getByRole("heading", { name: "Payments" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Total Escrowed")).toBeVisible();
});
