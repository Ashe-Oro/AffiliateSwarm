/**
 * End-to-end test against the staging environment.
 * Tests the full flow: register → discover → apply → click → postback → earnings
 *
 * Usage: npx tsx tests/e2e-staging.ts [BASE_URL]
 */
import { readFileSync } from "fs";

const BASE_URL = process.argv[2] || "https://affiliateswarm.ai";
const stripeDepositsEnabled = ["1", "true", "yes", "on"].includes(
  (process.env.ENABLE_STRIPE_DEPOSITS ?? "").toLowerCase()
);
const bankTransferEnabled = ["1", "true", "yes", "on"].includes(
  (process.env.ENABLE_BANK_TRANSFER ?? "").toLowerCase()
);

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err: any) {
    failed++;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message}`);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

async function api(method: string, path: string, body?: any, apiKey?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, json, text, headers: res.headers };
}

async function main() {
  console.log(`\nE2E Test Suite — ${BASE_URL}\n`);
  console.log("=" .repeat(60));

  // Load existing keys for advertiser/affiliate tests
  let stagingKeys: any;
  try {
    stagingKeys = JSON.parse(readFileSync("scripts/staging-keys.json", "utf-8"));
  } catch {
    console.log("WARNING: No staging-keys.json found, some tests will be skipped\n");
    stagingKeys = { advertisers: [], affiliates: [] };
  }

  const advertiserKey = stagingKeys.advertisers[0]?.apiKey;
  const advertiserAgentId = stagingKeys.advertisers[0]?.agentId;
  const advertiserCampaignId = stagingKeys.advertisers[0]?.campaignId;
  const affiliateKey = stagingKeys.affiliates[0]?.apiKey;
  const affiliateAgentId = stagingKeys.affiliates[0]?.agentId;

  // ── 1. Public endpoints ──
  console.log("\n1. Public Endpoints\n");

  await test("GET /skill.md returns markdown", async () => {
    const res = await fetch(`${BASE_URL}/skill.md`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    assert(ct.includes("text/markdown"), `Expected markdown, got ${ct}`);
    const text = await res.text();
    assert(text.includes("AffiliateSwarm"), "Body should mention AffiliateSwarm");
  });

  await test("GET /campaign-template.md returns markdown", async () => {
    const res = await fetch(`${BASE_URL}/campaign-template.md`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  // ── 2. Agent Registration ──
  console.log("\n2. Agent Registration\n");

  let newAgentId: string;
  let newApiKey: string;

  await test("POST /api/v1/agents — register new affiliate", async () => {
    const { status, json } = await api("POST", "/api/v1/agents", {
      displayName: `E2E-Test-${Date.now()}`,
      type: "AFFILIATE",
      description: "E2E test agent",
      email: `e2e-${Date.now()}@test.affiliateswarm.dev`,
    });
    assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(json)}`);
    assert(json.data.agent.id, "Missing agent ID");
    assert(json.data.apiKey, "Missing API key");
    assert(json.data.wallet.id, "Missing wallet ID");
    newAgentId = json.data.agent.id;
    newApiKey = json.data.apiKey;
  });

  await test("GET /api/v1/me — verify auth works", async () => {
    const { status, json } = await api("GET", "/api/v1/me", undefined, newApiKey);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(json.data.agent.id === newAgentId, "Agent ID mismatch");
  });

  await test("GET /api/v1/me — reject bad key", async () => {
    const { status } = await api("GET", "/api/v1/me", undefined, "swarm_live_invalidkey");
    assert(status === 401, `Expected 401, got ${status}`);
  });

  // ── 3. Campaign Discovery ──
  console.log("\n3. Campaign Discovery\n");

  await test("GET /api/v1/discover/campaigns — returns active campaigns", async () => {
    const { status, json } = await api("GET", "/api/v1/discover/campaigns", undefined, newApiKey);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(json.data.length > 0, "Should have at least 1 campaign");
    const names = json.data.map((c: any) => c.name);
    assert(names.some((n: string) => n.includes("Venice")), "Should include Venice campaign");
  });

  await test("GET /api/v1/discover/campaigns?compensationModel=CPA — filter works", async () => {
    const { status, json } = await api("GET", "/api/v1/discover/campaigns?compensationModel=CPA", undefined, newApiKey);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(json.data.every((c: any) => c.compensationModel === "CPA"), "All should be CPA");
  });

  // ── 4. Campaign Application ──
  console.log("\n4. Campaign Application\n");

  let enrollmentTrackingCode: string = "";

  await test("POST /api/v1/campaigns/:id/applications — apply to campaign", async () => {
    const { status, json } = await api(
      "POST",
      `/api/v1/campaigns/${advertiserCampaignId}/applications`,
      { pitch: "E2E test application — great fit for this campaign" },
      newApiKey
    );
    assert(status === 201 || status === 200, `Expected 201/200, got ${status}: ${JSON.stringify(json)}`);
  });

  if (advertiserKey) {
    await test("GET /api/v1/campaigns/:id/applications — advertiser sees application", async () => {
      const { status, json } = await api(
        "GET",
        `/api/v1/campaigns/${advertiserCampaignId}/applications`,
        undefined,
        advertiserKey
      );
      assert(status === 200, `Expected 200, got ${status}`);
      const apps = json.data || [];
      const myApp = apps.find((a: any) => a.affiliateId === newAgentId);
      assert(myApp, "Application should be visible to advertiser");
    });

    await test("PATCH /api/v1/campaigns/:id/applications/:appId — approve application", async () => {
      // Find the application
      const { json: listJson } = await api(
        "GET",
        `/api/v1/campaigns/${advertiserCampaignId}/applications`,
        undefined,
        advertiserKey
      );
      const myApp = (listJson.data || []).find((a: any) => a.affiliateId === newAgentId);
      assert(myApp, "Application not found");

      const { status, json } = await api(
        "PATCH",
        `/api/v1/campaigns/${advertiserCampaignId}/applications/${myApp.id}`,
        { decision: "APPROVED" },
        advertiserKey
      );
      assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(json)}`);
      assert(json.data.trackingCode, "Should return tracking code on approval");
      enrollmentTrackingCode = json.data.trackingCode;
    });
  }

  // ── 5. Click Tracking ──
  console.log("\n5. Click Tracking\n");

  if (enrollmentTrackingCode) {
    await test("GET mock landing with swarm_ref — landing captures tracking code", async () => {
      const res = await fetch(`${BASE_URL}/api/test/mock-landing?swarm_ref=${enrollmentTrackingCode}`);
      if (res.status === 404) {
        console.log("        SKIP  /api/test/mock-landing is not enabled in this environment");
        return;
      }
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const text = await res.text();
      assert(text.includes(`id="swarm-ref">${enrollmentTrackingCode}</code>`), "Landing page should render swarm_ref");
    });
  }

  // ── 6. Postback (Server-to-Server Conversion) ──
  console.log("\n6. Postback\n");

  if (enrollmentTrackingCode && advertiserKey) {
    await test("POST /api/v1/postback — report conversion", async () => {
      const { status, json } = await api("POST", "/api/v1/postback", {
        swarm_ref: enrollmentTrackingCode,
        externalId: `e2e-test-${Date.now()}`,
        eventType: "PURCHASE",
        revenueCents: 9900,
      }, advertiserKey);
      assert(status === 201 || status === 200, `Expected 201/200, got ${status}: ${JSON.stringify(json)}`);
      assert(json.data.status === "VERIFIED", `Lead should be verified, got ${json.data.status}`);
      assert(json.data.payoutCents > 0, "Should have a payout amount");
    });

    await test("POST /api/v1/postback — idempotent on same externalId", async () => {
      const extId = `e2e-idempotent-${Date.now()}`;
      const { status: s1 } = await api("POST", "/api/v1/postback", {
        swarm_ref: enrollmentTrackingCode,
        externalId: extId,
        eventType: "PURCHASE",
        revenueCents: 5000,
      }, advertiserKey);
      assert(s1 === 201 || s1 === 200, `First call failed: ${s1}`);

      const { status: s2, json: j2 } = await api("POST", "/api/v1/postback", {
        swarm_ref: enrollmentTrackingCode,
        externalId: extId,
        eventType: "PURCHASE",
        revenueCents: 5000,
      }, advertiserKey);
      assert(s2 === 200, `Second call should be 200 (idempotent), got ${s2}`);
      // Idempotent call returns the existing lead
      assert(j2.data.externalId === extId, "Should return the same lead");
    });
  }

  // ── 7. Wallet & Earnings ──
  console.log("\n7. Wallet & Earnings\n");

  await test("GET /api/v1/wallets/:agentId — check affiliate balance", async () => {
    const { status, json } = await api("GET", `/api/v1/wallets/${newAgentId}`, undefined, newApiKey);
    assert(status === 200, `Expected 200, got ${status}`);
    if (enrollmentTrackingCode) {
      assert(json.data.availableCents > 0, `Expected positive balance, got ${json.data.availableCents}`);
    }
  });

  // ── 8. Analytics ──
  console.log("\n8. Analytics\n");

  await test("GET /api/v1/analytics/overview — returns stats", async () => {
    const { status, json } = await api("GET", "/api/v1/analytics/overview", undefined, newApiKey);
    assert(status === 200, `Expected 200, got ${status}`);
    assert("totalLeads" in json.data, "Should have totalLeads");
  });

  // ── 9. Reputation ──
  console.log("\n9. Reputation\n");

  await test("GET /api/v1/reputation/:agentId — check reputation", async () => {
    const { status, json } = await api("GET", `/api/v1/reputation/${newAgentId}`, undefined, newApiKey);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(json.data.trustTier, "Should have trust tier");
  });

  // ── 10. Login Code Flow ──
  console.log("\n10. Login Code Flow\n");

  await test("POST /api/v1/auth/login-code — generate code", async () => {
    const { status, json } = await api("POST", "/api/v1/auth/login-code", {}, newApiKey);
    assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(json)}`);
    assert(json.data.code, "Should return a code");
    assert(json.data.code.length === 6, `Code should be 6 chars, got ${json.data.code.length}`);
    assert(json.data.expiresInSeconds === 300, "Should expire in 300s");
  });

  await test("POST /api/auth/verify-code — reject invalid code", async () => {
    const { status } = await api("POST", "/api/auth/verify-code", { code: "XXXXXX" });
    assert(status === 401, `Expected 401, got ${status}`);
  });

  // ── 12. Card/Bank Deposits ──
  console.log("\n12. Card/Bank Deposits\n");

  if (!stripeDepositsEnabled) {
    console.log("  SKIP  card/bank deposit tests (ENABLE_STRIPE_DEPOSITS not set)\n");
  } else if (advertiserKey && advertiserCampaignId) {
    await test("POST /api/v1/wallets/:agentId/deposits/stripe — create card checkout", async () => {
      const { status, json } = await api(
        "POST",
        `/api/v1/wallets/${advertiserAgentId}/deposits/stripe`,
        { campaignId: advertiserCampaignId, amountCents: 5000, paymentMethod: "card" },
        advertiserKey
      );
      assert(status === 200 || status === 201, `Expected 200/201, got ${status}: ${JSON.stringify(json)}`);
      assert(json.data.url, "Should return a hosted checkout URL");
      assert(json.data.url.includes("checkout.stripe.com"), `Unexpected checkout URL: ${json.data.url}`);
    });

    if (bankTransferEnabled) {
      await test("POST /api/v1/wallets/:agentId/deposits/stripe — create ACH checkout", async () => {
        const { status, json } = await api(
          "POST",
          `/api/v1/wallets/${advertiserAgentId}/deposits/stripe`,
          { campaignId: advertiserCampaignId, amountCents: 10000, paymentMethod: "ach" },
          advertiserKey
        );
        assert(status === 200 || status === 201, `Expected 200/201, got ${status}: ${JSON.stringify(json)}`);
        assert(json.data.url, "Should return a hosted checkout URL");
        assert(json.data.url.includes("checkout.stripe.com"), `Unexpected checkout URL: ${json.data.url}`);
      });
    } else {
      console.log("  SKIP  ACH checkout test (ENABLE_BANK_TRANSFER not set)\n");
    }

    await test("POST /api/v1/wallets/:agentId/deposits/stripe — reject below minimum", async () => {
      const { status, json } = await api(
        "POST",
        `/api/v1/wallets/${advertiserAgentId}/deposits/stripe`,
        { campaignId: advertiserCampaignId, amountCents: 500, paymentMethod: "card" },
        advertiserKey
      );
      assert(status === 400, `Expected 400, got ${status}`);
    });
  }

  // ── 13. Affiliate Payouts ──
  console.log("\n13. Affiliate Payouts\n");

  await test("POST /api/v1/payouts — request CRYPTO payout", async () => {
    // Check balance first
    const { json: walletJson } = await api("GET", `/api/v1/wallets/${newAgentId}`, undefined, newApiKey);
    const available = walletJson.data.availableCents;

    if (available >= 100) {
      const { status, json } = await api("POST", "/api/v1/payouts", {
        amountCents: 100,
        method: "CRYPTO",
        destination: { chainAddress: "0x1234567890abcdef1234567890abcdef12345678" },
      }, newApiKey);
      assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(json)}`);
      assert(json.data.status === "PENDING", "Payout should be PENDING");
      assert(json.data.method === "CRYPTO", "Method should be CRYPTO");
    } else {
      // Agent has no balance — test that it rejects
      const { status } = await api("POST", "/api/v1/payouts", {
        amountCents: 100,
        method: "CRYPTO",
        destination: { chainAddress: "0x1234567890abcdef1234567890abcdef12345678" },
      }, newApiKey);
      assert(status === 400, `Expected 400 (insufficient balance), got ${status}`);
    }
  });

  await test("POST /api/v1/payouts — request BANK_TRANSFER payout", async () => {
    const { json: walletJson } = await api("GET", `/api/v1/wallets/${newAgentId}`, undefined, newApiKey);
    const available = walletJson.data.availableCents;

    if (available >= 100) {
      const { status, json } = await api("POST", "/api/v1/payouts", {
        amountCents: 100,
        method: "BANK_TRANSFER",
        destination: { stripeAccountId: "acct_test123456789" },
      }, newApiKey);
      assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(json)}`);
      assert(json.data.status === "PENDING", "Payout should be PENDING");
      assert(json.data.method === "BANK_TRANSFER", "Method should be BANK_TRANSFER");
    } else {
      const { status } = await api("POST", "/api/v1/payouts", {
        amountCents: 100,
        method: "BANK_TRANSFER",
        destination: { stripeAccountId: "acct_test123456789" },
      }, newApiKey);
      assert(status === 400, `Expected 400 (insufficient balance), got ${status}`);
    }
  });

  await test("POST /api/v1/payouts — reject invalid BANK_TRANSFER destination", async () => {
    const { status } = await api("POST", "/api/v1/payouts", {
      amountCents: 100,
      method: "BANK_TRANSFER",
      destination: { routingNumber: "123456789" },
    }, newApiKey);
    assert(status === 400, `Expected 400, got ${status}`);
  });

  await test("GET /api/v1/payouts — list payout requests", async () => {
    const { status, json } = await api("GET", "/api/v1/payouts", undefined, newApiKey);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(json.data), "Should return array");
  });

  // ── 14. Referral Tokens ──
  console.log("\n14. Referral Tokens\n");

  let referralId: string = "";

  await test("POST /api/v1/referrals — create referral token for campaign", async () => {
    // Use the newly enrolled agent (approved earlier) to create a referral
    const { status, json } = await api("POST", "/api/v1/referrals", {
      campaignId: advertiserCampaignId,
    }, newApiKey);
    assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(json)}`);
    assert(json.data.id, "Should return a referral ID");
    assert(json.data.token, "Should return a referral token");
    referralId = json.data.id;
  });

  await test("POST /api/v1/referrals — reject referral for unenrolled campaign", async () => {
    // newApiKey agent is not enrolled in the N8N campaign
    const n8nCampaignId = stagingKeys.advertisers[1]?.campaignId;
    if (!n8nCampaignId) throw new Error("No second campaign to test against");
    const { status } = await api("POST", "/api/v1/referrals", {
      campaignId: n8nCampaignId,
    }, newApiKey);
    assert(status === 400 || status === 403, `Expected 400/403 for unenrolled, got ${status}`);
  });

  await test("POST /api/v1/referrals/:referralId/confirm — confirm referral as advertiser", async () => {
    if (!referralId) throw new Error("No referral ID from previous test");
    const { status, json } = await api("POST", `/api/v1/referrals/${referralId}/confirm`, {
      revenueCents: 5000,
    }, advertiserKey);
    assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(json)}`);
  });

  // ── 15. Lead Submission ──
  console.log("\n15. Lead Submission\n");

  let submittedLeadId: string = "";
  const leadExternalId = `e2e-lead-${Date.now()}`;

  await test("POST /api/v1/leads — submit a lead with tracking code", async () => {
    const { status, json } = await api("POST", "/api/v1/leads", {
      campaignId: advertiserCampaignId,
      externalId: leadExternalId,
      trackingCode: enrollmentTrackingCode || undefined,
      leadData: { source: "e2e-test", timestamp: Date.now() },
    }, newApiKey);
    assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(json)}`);
    assert(json.data.id, "Should return lead ID");
    assert(json.data.status, "Should return lead status");
    submittedLeadId = json.data.id;
  });

  await test("POST /api/v1/leads — reject duplicate lead (same externalId)", async () => {
    const { status } = await api("POST", "/api/v1/leads", {
      campaignId: advertiserCampaignId,
      externalId: leadExternalId,
    }, newApiKey);
    assert(status === 409 || status === 400, `Expected 409/400 for duplicate, got ${status}`);
  });

  await test("POST /api/v1/leads — submit lead with evidence attachments", async () => {
    const { status, json } = await api("POST", "/api/v1/leads", {
      campaignId: advertiserCampaignId,
      externalId: `e2e-evidence-${Date.now()}`,
      evidence: [
        { type: "tweet", url: "https://x.com/example/status/123", description: "Promo tweet" },
        { type: "blog_post", url: "https://example.com/review", description: "Review post" },
      ],
    }, newApiKey);
    assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(json)}`);
  });

  await test("GET /api/v1/leads — list leads as affiliate", async () => {
    const { status, json } = await api("GET", `/api/v1/leads`, undefined, newApiKey);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(json.data), "Should return array of leads");
  });

  // ── 16. Wallet Operations ──
  console.log("\n16. Wallet Operations\n");

  await test("GET /api/v1/me — wallet info is auto-provisioned at registration", async () => {
    const { status, json } = await api("GET", `/api/v1/me`, undefined, newApiKey);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(json.data.wallet, "Should have wallet on /me");
    assert(
      json.data.wallet.depositAddress &&
        /^0x[0-9a-fA-F]{40}$/.test(json.data.wallet.depositAddress),
      "Wallet should have a valid Base deposit address from registration"
    );
  });

  await test("GET /api/v1/wallets/:agentId — balance returns correct fields", async () => {
    const { status, json } = await api("GET", `/api/v1/wallets/${newAgentId}`, undefined, newApiKey);
    assert(status === 200, `Expected 200, got ${status}`);
    assert("availableCents" in json.data, "Should have availableCents");
    assert("heldCents" in json.data, "Should have heldCents");
    assert("currency" in json.data, "Should have currency");
    assert("walletType" in json.data, "Should have walletType");
  });

  await test("GET /api/v1/wallets/:agentId/chain-balance — endpoint exists", async () => {
    const { status } = await api("GET", `/api/v1/wallets/${newAgentId}/chain-balance`, undefined, newApiKey);
    // 200 if chain address set, 400 if not initialized on-chain yet — both are valid
    assert(status === 200 || status === 400, `Expected 200 or 400, got ${status}`);
  });

  // ── 17. Campaign CRUD ──
  console.log("\n17. Campaign CRUD\n");

  let createdCampaignId: string = "";

  await test("POST /api/v1/campaigns — create a new campaign as advertiser", async () => {
    const { status, json } = await api("POST", "/api/v1/campaigns", {
      name: `E2E Test Campaign ${Date.now()}`,
      description: "Automated test campaign",
      compensationModel: "CPA",
      payoutPerUnitCents: 500,
      budgetCents: 100000,
      currency: "USD",
      enrollmentPolicy: "OPEN",
      categories: ["testing"],
      geoTargets: ["US"],
    }, advertiserKey);
    assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(json)}`);
    assert(json.data.campaign.id, "Should return campaign ID");
    assert(json.data.campaign.status === "DRAFT", `Expected DRAFT status, got ${json.data.campaign.status}`);
    assert(json.data.escrowAccount.id, "Should return escrow account");
    createdCampaignId = json.data.campaign.id;
  });

  await test("PATCH /api/v1/campaigns/:campaignId — update campaign details", async () => {
    if (!createdCampaignId) throw new Error("No campaign ID from previous test");
    const { status, json } = await api("PATCH", `/api/v1/campaigns/${createdCampaignId}`, {
      description: "Updated description for E2E test",
      payoutPerUnitCents: 750,
    }, advertiserKey);
    assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(json)}`);
  });

  await test("POST /api/v1/campaigns/:campaignId/activate — should fail without escrow", async () => {
    if (!createdCampaignId) throw new Error("No campaign ID from previous test");
    const { status } = await api("POST", `/api/v1/campaigns/${createdCampaignId}/activate`, {}, advertiserKey);
    // Should fail because escrow is not funded
    assert(status === 400 || status === 422, `Expected 400/422 (no escrow funded), got ${status}`);
  });

  await test("GET /api/v1/campaigns — list campaigns by advertiser", async () => {
    const { status, json } = await api("GET", "/api/v1/campaigns", undefined, advertiserKey);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(json.data), "Should return array");
    assert(json.data.length >= 1, "Should have at least 1 campaign");
    const ids = json.data.map((c: any) => c.id);
    assert(ids.includes(advertiserCampaignId), "Should include the known campaign");
  });

  // ── 18. Webhook Registration ──
  console.log("\n18. Webhook Registration\n");

  await test("POST /api/v1/webhooks — register webhook endpoint", async () => {
    const { status, json } = await api("POST", "/api/v1/webhooks", {
      url: "https://example.com/webhook/e2e-test",
      events: ["lead.created", "lead.verified"],
    }, advertiserKey);
    assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(json)}`);
    assert(json.data.id, "Should return webhook ID");
  });

  await test("POST /api/v1/webhooks — reject invalid webhook URL", async () => {
    const { status } = await api("POST", "/api/v1/webhooks", {
      url: "not-a-valid-url",
      events: ["lead.created"],
    }, advertiserKey);
    assert(status === 400, `Expected 400, got ${status}`);
  });

  // ── 19. Agent Management ──
  console.log("\n19. Agent Management\n");

  await test("PATCH /api/v1/agents/:agentId — update agent profile", async () => {
    const { status, json } = await api("PATCH", `/api/v1/agents/${newAgentId}`, {
      description: "Updated E2E test agent description",
      websiteUrl: "https://e2e-test-agent.example.com",
      capabilities: ["content_creation", "social_media"],
    }, newApiKey);
    assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(json)}`);
    assert(json.data.description === "Updated E2E test agent description", "Description should be updated");
  });

  await test("GET /api/v1/agents?type=AFFILIATE — search agents by type", async () => {
    const { status, json } = await api("GET", "/api/v1/agents?type=AFFILIATE", undefined, newApiKey);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(json.data), "Should return array");
    assert(json.data.every((a: any) => a.type === "AFFILIATE"), "All results should be AFFILIATE type");
  });

  await test("POST /api/v1/agents — reject registration with missing email", async () => {
    const { status } = await api("POST", "/api/v1/agents", {
      displayName: "No-Email Agent",
      type: "AFFILIATE",
      description: "Should fail without email",
    });
    assert(status === 400, `Expected 400 for missing email, got ${status}`);
  });

  // ── 20. Error Handling ──
  console.log("\n20. Error Handling\n");

  await test("GET /api/v1/leads/:leadId — 404 on non-existent lead", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const { status } = await api("GET", `/api/v1/leads/${fakeId}`, undefined, advertiserKey);
    assert(status === 404, `Expected 404, got ${status}`);
  });

  await test("GET /api/v1/leads/:leadId — 403 on unauthorized lead access", async () => {
    // submittedLeadId was created by newApiKey; a different agent (advertiser of another campaign) should not have access
    if (!submittedLeadId) throw new Error("No lead ID from previous test");
    const otherKey = stagingKeys.advertisers[2]?.apiKey; // Bolt.new advertiser — different campaign
    if (!otherKey) throw new Error("No third advertiser key for auth test");
    const { status } = await api("GET", `/api/v1/leads/${submittedLeadId}`, undefined, otherKey);
    assert(status === 403, `Expected 403, got ${status}`);
  });

  await test("POST /api/auth/verify-code — 401 on expired/invalid login code", async () => {
    const { status } = await api("POST", "/api/auth/verify-code", { code: "ZZZZZZ" });
    assert(status === 401, `Expected 401, got ${status}`);
  });

  await test("POST /api/v1/campaigns — 400 on invalid campaign creation (missing required fields)", async () => {
    const { status } = await api("POST", "/api/v1/campaigns", {
      // Missing name, compensationModel, payoutPerUnitCents, budgetCents
      description: "This should fail validation",
    }, advertiserKey);
    assert(status === 400, `Expected 400, got ${status}`);
  });

  // ── 21. Edge Cases ──
  console.log("\n21. Edge Cases\n");

  await test("GET /api/v1/discover/campaigns?geo=US — campaign discovery with geo filter", async () => {
    const { status, json } = await api("GET", "/api/v1/discover/campaigns?geo=US", undefined, newApiKey);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(json.data), "Should return array");
  });

  await test("GET /api/v1/discover/campaigns?category=testing — campaign discovery with category filter", async () => {
    const { status, json } = await api("GET", "/api/v1/discover/campaigns?category=testing", undefined, newApiKey);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(json.data), "Should return array");
  });

  await test("GET /api/v1/discover/campaigns?page=2&pageSize=2 — pagination works", async () => {
    const { status, json } = await api("GET", "/api/v1/discover/campaigns?page=2&pageSize=2", undefined, newApiKey);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(json.data), "Should return array");
    assert(json.pagination?.page === 2 || json.meta?.page === 2, "Page should be 2");
    assert(json.pagination?.pageSize === 2 || json.meta?.pageSize === 2, "PageSize should be 2");
  });

  await test("Response includes rate limit headers", async () => {
    const { status, headers } = await api("GET", "/api/v1/me", undefined, newApiKey);
    assert(status === 200, `Expected 200, got ${status}`);
    // Rate limit headers are set by withRateLimit middleware on /me endpoint
    const hasRateLimit = headers.has("x-ratelimit-limit") || headers.has("x-ratelimit-remaining");
    assert(hasRateLimit, "Response should include rate limit headers");
  });

  await test("GET /skill.md — contains required sections (tracking, payouts, login code)", async () => {
    const res = await fetch(`${BASE_URL}/skill.md`);
    const text = await res.text();
    const lower = text.toLowerCase();
    assert(lower.includes("tracking") || lower.includes("track"), "skill.md should mention tracking");
    assert(lower.includes("payout") || lower.includes("earning"), "skill.md should mention payouts/earnings");
    assert(lower.includes("login") || lower.includes("auth"), "skill.md should mention login/auth");
  });

  // ── 22. Sandbox / Multi-tenant ──
  console.log("\n22. Sandbox / Multi-tenant\n");

  await test("GET /api/v1/analytics/overview — returns numeric fields", async () => {
    const { status, json } = await api("GET", "/api/v1/analytics/overview", undefined, advertiserKey);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(typeof json.data.totalLeads === "number", "totalLeads should be a number");
    assert(typeof json.data.totalClicks === "number" || typeof json.data.totalConversions === "number",
      "Should have numeric totalClicks or totalConversions");
  });

  // ── 23. Dashboard Auth ──
  console.log("\n23. Dashboard Auth\n");

  let loginCode: string = "";

  await test("POST /api/v1/auth/login-code — generates valid 6-char code", async () => {
    const { status, json } = await api("POST", "/api/v1/auth/login-code", {}, affiliateKey);
    assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(json)}`);
    assert(json.data.code, "Should return a code");
    assert(json.data.code.length === 6, `Code should be 6 chars, got ${json.data.code.length}`);
    assert(/^[A-Z0-9]+$/.test(json.data.code), "Code should be alphanumeric uppercase");
    loginCode = json.data.code;
  });

  await test("POST /api/auth/verify-code — login code verify creates session cookie", async () => {
    if (!loginCode) throw new Error("No login code from previous test");
    const res = await fetch(`${BASE_URL}/api/auth/verify-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: loginCode }),
      redirect: "manual",
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const setCookie = res.headers.get("set-cookie") || "";
    assert(setCookie.includes("session"), `Should set session cookie, got: ${setCookie}`);
  });

  await test("POST /api/auth/verify-code — verify code rejects after use (single-use)", async () => {
    if (!loginCode) throw new Error("No login code from previous test");
    const { status } = await api("POST", "/api/auth/verify-code", { code: loginCode });
    assert(status === 401, `Expected 401 for reused code, got ${status}`);
  });

  // ── 24. Skill Redirect Flow ──
  console.log("\n24. Skill Redirect Flow\n");

  await test("GET /skill.md — redirects to /affiliate/skill.md", async () => {
    const res = await fetch(`${BASE_URL}/skill.md`, { redirect: "manual" });
    assert(res.status === 302 || res.status === 307, `Expected redirect, got ${res.status}`);
    const location = res.headers.get("location") || "";
    assert(location.includes("/affiliate/skill.md"), `Should redirect to affiliate skill, got: ${location}`);
  });

  // ── 25. New Affiliate → Campaign → Conversion ──
  console.log("\n25. New Affiliate Campaign Conversion Flow\n");

  // Uses the existing funded advertiser campaign from staging-keys.json
  // Tests: new affiliate registers → applies → gets approved →
  //        advertiser fires postback → affiliate gets paid

  let refAffId = "";
  let refAffKey = "";

  await test("Register new affiliate", async () => {
    const { status, json } = await api("POST", "/api/v1/agents", {
      displayName: `Referred-Affiliate-${Date.now()}`,
      type: "AFFILIATE",
      email: `ref-aff-${Date.now()}@test.affiliateswarm.dev`,
      description: "E2E referred affiliate",
    });
    assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(json)}`);
    refAffId = json.data.agent.id;
    refAffKey = json.data.apiKey;
  });

  // Apply to the existing funded campaign (OPEN enrollment = auto-approved)
  let refTrackingCode = "";

  await test("Referred affiliate applies to existing campaign", async () => {
    const { status, json } = await api("POST", `/api/v1/campaigns/${advertiserCampaignId}/applications`, {
      pitch: "E2E referral flow test",
    }, refAffKey);
    assert(status === 200 || status === 201, `Expected 200/201, got ${status}: ${JSON.stringify(json)}`);
    refTrackingCode = json.data.trackingCode;
    assert(!!refTrackingCode, "Should get tracking code on approval");
  });

  // Advertiser fires postback for the referred affiliate's tracking code
  await test("Postback for referred affiliate — conversion tracked", async () => {
    const { status, json } = await api("POST", "/api/v1/postback", {
      swarm_ref: refTrackingCode,
      externalId: `ref-flow-${Date.now()}`,
      eventType: "PURCHASE",
      revenueCents: 5000,
    }, advertiserKey);
    assert(status === 200 || status === 201, `Expected 200/201, got ${status}: ${JSON.stringify(json)}`);
    assert(json.data.status === "VERIFIED", `Lead should be verified, got ${json.data.status}`);
  });

  // Verify referred affiliate got paid (full amount — fee is on advertiser, not affiliate)
  await test("Referred affiliate received full payout", async () => {
    const { status, json } = await api("GET", `/api/v1/wallets/${refAffId}`, undefined, refAffKey);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(json.data.availableCents > 0, `Affiliate should have positive balance, got ${json.data.availableCents}`);
  });

  // ── Results ──
  console.log("\n" + "=".repeat(60));
  console.log(`\n  ${passed} passed, ${failed} failed\n`);

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("E2E suite crashed:", e);
  process.exit(1);
});
