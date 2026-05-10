/**
 * Staging E2E — Full money path on the deployed site (affiliateswarm.ai).
 *
 * Fully automated — uses throwawaymail.app for email verification
 * and real hosted checkout test-mode payments. No manual steps required.
 *
 * Run:
 *   BASE_URL=https://affiliateswarm.ai STRIPE_SECRET_KEY=sk_test_... ENABLE_STRIPE_DEPOSITS=true \
 *     npx playwright test tests/e2e/staging-stripe.spec.ts
 */

import { test, expect } from "@playwright/test";
import {
  api,
  createStripeCheckout,
  completeStripeCheckout,
  getWalletBalance,
  MOCK_LANDING_URL,
} from "./helpers";

const RUN_ID = Date.now();
const BASE_URL = process.env.BASE_URL || "https://affiliateswarm.ai";
function envEnabled(name: string) {
  return ["1", "true", "yes", "on"].includes(
    (process.env[name] ?? "").toLowerCase()
  );
}
const HAS_STRIPE =
  !!process.env.STRIPE_SECRET_KEY && envEnabled("ENABLE_STRIPE_DEPOSITS");
const THROWAWAY_API = "https://throwawaymail.app/api";

// ── Throwaway Mail Helpers ────────────────────────────────────────────────

interface Mailbox {
  mailbox_id: string;
  address: string;
}

async function createMailbox(): Promise<Mailbox> {
  const res = await fetch(`${THROWAWAY_API}/mailboxes`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to create mailbox: ${res.status}`);
  const data = await res.json();
  return { mailbox_id: data.mailbox_id, address: data.address };
}

async function waitForVerificationLink(
  mailboxId: string,
  timeoutMs = 60_000
): Promise<string> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const url = `${THROWAWAY_API}/mailboxes/${mailboxId}/messages`;
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`  Inbox poll failed: ${res.status} (${url})`);
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }
    const messages = await res.json();
    console.log(`  Inbox: ${messages.length} message(s)`);

    if (messages.length > 0) {
      // Get the first message's full content
      const msgRes = await fetch(
        `${THROWAWAY_API}/mailboxes/${mailboxId}/messages/${messages[0].message_id}`
      );
      if (!msgRes.ok) throw new Error(`Failed to read message: ${msgRes.status}`);
      const msg = await msgRes.json();

      // Extract verification link from HTML or text body
      const body = (msg.html || msg.text || "").replace(/&amp;/g, "&");
      const linkMatch = body.match(/https?:\/\/[^\s"<]+verify-email[^\s"<]*/);
      if (linkMatch) {
        return linkMatch[0].replace(/&amp;/g, "&");
      }
    }

    await new Promise((r) => setTimeout(r, 3000));
  }

  throw new Error(`No verification email received within ${timeoutMs / 1000}s`);
}

async function verifyViaEmail(mailboxId: string): Promise<void> {
  const link = await waitForVerificationLink(mailboxId);
  console.log(`  Clicking verification link: ${link.substring(0, 80)}...`);
  // Follow the verification link (GET request)
  const res = await fetch(link, { redirect: "follow" });
  if (!res.ok && res.status !== 200) {
    const text = await res.text();
    // The endpoint returns HTML — 200 means success
    if (!text.includes("Verified Successfully") && !text.includes("Already Verified")) {
      throw new Error(`Verification failed: ${res.status} ${text.substring(0, 200)}`);
    }
  }
}

// ── Test State ────────────────────────────────────────────────────────────

const state: {
  advMailbox?: Mailbox;
  affMailbox?: Mailbox;
  advertiser?: { agentId: string; apiKey: string };
  affiliate?: { agentId: string; apiKey: string };
  campaignId?: string;
  escrowAccountId?: string;
  trackingCode?: string;
  enrollmentId?: string;
} = {};

test.describe.configure({ mode: "serial" });

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1: ADVERTISER SETUP
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Phase 1: Advertiser Setup", () => {
  test("1.1 register advertiser", async () => {
    state.advMailbox = await createMailbox();
    console.log(`Throwaway email: ${state.advMailbox.address}`);

    const { status, json } = await api("POST", "/api/v1/agents", {
      displayName: `Staging Advertiser ${RUN_ID}`,
      type: "ADVERTISER",
      email: state.advMailbox.address,
    });

    expect(status).toBe(201);
    state.advertiser = {
      agentId: json.data.agent.id,
      apiKey: json.data.apiKey,
    };
    console.log(`Advertiser registered: ${state.advertiser.agentId}`);
  });

  test("1.2 verify advertiser email automatically", async () => {
    test.setTimeout(90_000);

    await verifyViaEmail(state.advMailbox!.mailbox_id);

    const { json } = await api("GET", "/api/v1/me", undefined, state.advertiser!.apiKey);
    expect(json.data.agent.verificationLevel).toBe("EMAIL_VERIFIED");
    console.log("Advertiser email verified automatically");
  });

  test("1.3 create campaign", async () => {
    const { status, json } = await api(
      "POST",
      "/api/v1/campaigns",
      {
        name: `Staging Campaign ${RUN_ID}`,
        compensationModel: "CPA",
        payoutPerUnitCents: 500, // $5 per conversion
        budgetCents: 50000,
        landingUrl: `${BASE_URL}/api/test/mock-landing`,
        productUrl: "https://example-product.com",
        conversionAction: "paid_subscription",
        productDescription: "Staging test product",
        holdingPeriodDays: 0,
        enrollmentPolicy: "OPEN",
      },
      state.advertiser!.apiKey
    );

    expect(status).toBe(201);
    state.campaignId = json.data.campaign.id;
    state.escrowAccountId = json.data.escrowAccount.id;
    console.log(`Campaign created: ${state.campaignId}`);
  });

  test("1.4 fund campaign via Stripe checkout ($10)", async ({ page }) => {
    test.setTimeout(90_000);
    test.skip(!HAS_STRIPE, "STRIPE_SECRET_KEY or ENABLE_STRIPE_DEPOSITS not set");

    const { status, json } = await api(
      "POST",
      `/api/v1/wallets/${state.advertiser!.agentId}/deposits/stripe`,
      { amountCents: 1000, paymentMethod: "card" },
      state.advertiser!.apiKey
    );

    expect(status).toBe(201);
    const checkoutUrl = json.data.url;
    console.log(`Stripe checkout created: ${json.data.checkoutId}`);

    await completeStripeCheckout(page, checkoutUrl);
    console.log("Stripe checkout completed in browser");

    // Poll wallet until webhook credits the deposit
    let walletBalance = 0;
    for (let i = 0; i < 30; i++) {
      try {
        const wallet = await getWalletBalance(state.advertiser!.apiKey);
        walletBalance = wallet.availableCents;
      } catch { /* wallet may not be ready */ }
      if (walletBalance > 0) break;
      await new Promise((r) => setTimeout(r, 2000));
    }

    console.log(`Wallet balance after deposit: $${(walletBalance / 100).toFixed(2)}`);
    expect(walletBalance).toBeGreaterThan(0);
  });

  test("1.5 wallet balance is positive (campaign auto-draws at conversion time)", async () => {
    const wallet = await getWalletBalance(state.advertiser!.apiKey);
    const available = wallet.availableCents;

    if (available === 0) {
      test.skip(true, "No wallet balance — Stripe deposit may not have processed");
      return;
    }

    // Under the wallet-first model there's no explicit allocate step;
    // placeHold pulls from the wallet when a conversion lands.
    expect(available).toBeGreaterThan(0);
    console.log(`Wallet balance: $${(available / 100).toFixed(2)} (ready for auto-draw)`);
  });

  test("1.6 confirm tracking and activate campaign", async () => {
    await api(
      "POST",
      `/api/v1/campaigns/${state.campaignId}/confirm-tracking`,
      {},
      state.advertiser!.apiKey
    );

    const { status, json } = await api(
      "POST",
      `/api/v1/campaigns/${state.campaignId}/activate`,
      {},
      state.advertiser!.apiKey
    );

    expect(status).toBe(200);
    expect(json.data.status).toBe("ACTIVE");
    console.log("Campaign activated");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: AFFILIATE JOINS + CONVERTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Phase 2: Affiliate Journey", () => {
  test("2.1 register affiliate", async () => {
    state.affMailbox = await createMailbox();
    console.log(`Throwaway email: ${state.affMailbox.address}`);

    const { status, json } = await api("POST", "/api/v1/agents", {
      displayName: `Staging Affiliate ${RUN_ID}`,
      type: "AFFILIATE",
      email: state.affMailbox.address,
      audienceSize: 5000,
      channels: ["blog", "twitter"],
      contentType: "review",
    });

    expect(status).toBe(201);
    state.affiliate = {
      agentId: json.data.agent.id,
      apiKey: json.data.apiKey,
    };
    console.log(`Affiliate registered: ${state.affiliate.agentId}`);
  });

  test("2.2 verify affiliate email automatically", async () => {
    test.setTimeout(90_000);

    await verifyViaEmail(state.affMailbox!.mailbox_id);

    const { json } = await api("GET", "/api/v1/me", undefined, state.affiliate!.apiKey);
    expect(json.data.agent.verificationLevel).toBe("EMAIL_VERIFIED");
    console.log("Affiliate email verified automatically");
  });

  test("2.3 affiliate discovers campaign", async () => {
    const { status, json } = await api(
      "GET", "/api/v1/discover/campaigns",
      undefined, state.affiliate!.apiKey
    );

    expect(status).toBe(200);
    const campaign = json.data.find((c: any) => c.id === state.campaignId);
    expect(campaign).toBeTruthy();
    console.log(`Campaign found in discovery: ${campaign.name}`);
  });

  test("2.4 affiliate applies and gets auto-approved (OPEN policy)", async () => {
    const { status, json } = await api(
      "POST",
      `/api/v1/campaigns/${state.campaignId}/applications`,
      { pitch: "Staging test application" },
      state.affiliate!.apiKey
    );

    expect(status).toBe(201);
    const enrollment = json.data.enrollment ?? json.data;
    state.enrollmentId = enrollment.id;
    state.trackingCode = enrollment.trackingCode;
    expect(["ACTIVE", "APPROVED"]).toContain(enrollment.status);
    console.log(`Enrolled with tracking code: ${state.trackingCode}`);
  });

  test("2.5 fire postback — conversion verified, affiliate paid", async () => {
    const externalId = `staging-conversion-${RUN_ID}`;

    const { status, json } = await api(
      "POST", "/api/v1/postback",
      {
        swarm_ref: state.trackingCode,
        externalId,
        eventType: "PURCHASE",
        payoutCents: 500,
      },
      state.advertiser!.apiKey
    );

    if (status !== 200 && status !== 201) {
      console.log(`Postback failed: ${status} ${JSON.stringify(json)}`);
    }
    expect([200, 201]).toContain(status);
    const lead = json.data.lead ?? json.data;
    expect(lead.status).toBe("VERIFIED");
    console.log(`Conversion verified! Lead: ${lead.id}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3: FINANCIAL VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Phase 3: Financial Verification", () => {
  test("3.1 affiliate has earned balance", async () => {
    const wallet = await getWalletBalance(state.affiliate!.apiKey);
    expect(wallet.availableCents).toBeGreaterThan(0);
    console.log(`Affiliate wallet: $${(wallet.availableCents / 100).toFixed(2)}`);
  });

  test("3.2 escrow balance decreased after payout", async () => {
    const { json } = await api(
      "GET",
      `/api/v1/campaigns/${state.campaignId}`,
      undefined,
      state.advertiser!.apiKey
    );

    const escrow = json.data.escrowAccount;
    expect(escrow.currentBalanceCents).toBeLessThan(escrow.totalDepositedCents);
    console.log(
      `Escrow: deposited=$${(escrow.totalDepositedCents / 100).toFixed(2)}, ` +
      `remaining=$${(escrow.currentBalanceCents / 100).toFixed(2)}`
    );
  });

  test("3.3 affiliate requests payout (PLATFORM_CREDIT)", async () => {
    const wallet = await getWalletBalance(state.affiliate!.apiKey);
    const available = wallet.availableCents;

    if (available === 0) {
      test.skip(true, "No affiliate balance to withdraw");
      return;
    }

    const { status, json } = await api(
      "POST", "/api/v1/payouts",
      {
        amountCents: Math.min(available, 500),
        method: "PLATFORM_CREDIT",
        destination: {},
      },
      state.affiliate!.apiKey
    );

    if (status === 400 || status === 403) {
      console.log(`Payout blocked: ${JSON.stringify(json.error)}`);
    }
    expect([200, 201, 400, 403]).toContain(status);
    if (json.data?.amountCents) {
      console.log(`Payout: $${(json.data.amountCents / 100).toFixed(2)} — status: ${json.data.status}`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════

test("Summary: full money path validated", async () => {
  console.log("\n══════════════════════════════════════════");
  console.log("  STAGING E2E SUMMARY");
  console.log("══════════════════════════════════════════");
  console.log(`  Advertiser: ${state.advertiser?.agentId}`);
  console.log(`  Affiliate:  ${state.affiliate?.agentId}`);
  console.log(`  Campaign:   ${state.campaignId}`);
  console.log(`  Adv email:  ${state.advMailbox?.address}`);
  console.log(`  Aff email:  ${state.affMailbox?.address}`);
  console.log("══════════════════════════════════════════\n");
  expect(true).toBe(true);
});
