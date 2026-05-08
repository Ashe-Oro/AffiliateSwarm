/**
 * Full E2E test for AffiliateSwarm — runs against local dev server.
 *
 * Prerequisites:
 *   npx tsx tests/seed-test-campaign.ts   (one-time setup)
 *   npx next dev --port 3099 &              (start dev server)
 *
 * Usage:
 *   npx tsx tests/e2e-test.ts [BASE_URL]
 */
import { readFileSync } from "fs";

const BASE_URL = process.argv[2] || "http://localhost:3099";

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
  // Load test keys
  let keys: any;
  try {
    keys = JSON.parse(readFileSync("tests/e2e-test-keys.json", "utf-8"));
  } catch {
    console.error("ERROR: Run 'npx tsx tests/seed-test-campaign.ts' first");
    process.exit(1);
  }

  const advKey = keys.advertiser.apiKey;
  const advId = keys.advertiser.agentId;
  const campaignId = keys.advertiser.campaignId;
  const affKey = keys.affiliate.apiKey;
  const affId = keys.affiliate.agentId;
  const partnerCode = keys.partner.referralCode;

  console.log(`\nAffiliateSwarm E2E Test — ${BASE_URL}\n`);
  console.log("=".repeat(60));

  // ── 1. Skill Files ──
  console.log("\n1. Skill Files\n");

  await test("GET /affiliate/skill.md — accessible without auth", async () => {
    const res = await fetch(`${BASE_URL}/affiliate/skill.md`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const text = await res.text();
    assert(text.includes("AffiliateSwarm"), "Should mention AffiliateSwarm");
  });

  await test("GET /advertiser/skill.md — accessible without auth", async () => {
    const res = await fetch(`${BASE_URL}/advertiser/skill.md`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test("GET /skill.md — redirects to /affiliate/skill.md", async () => {
    const res = await fetch(`${BASE_URL}/skill.md`, { redirect: "manual" });
    assert(res.status === 302 || res.status === 307, `Expected redirect, got ${res.status}`);
    const loc = res.headers.get("location") || "";
    assert(loc.includes("/affiliate/skill.md"), `Should redirect to affiliate, got: ${loc}`);
  });

  // ── 2. Referral Link Flow ──
  console.log("\n2. Referral Link Flow\n");

  await test("GET /r/:code — sets cookie and redirects", async () => {
    const res = await fetch(`${BASE_URL}/r/${partnerCode}`, { redirect: "manual" });
    assert(res.status === 302 || res.status === 307, `Expected redirect, got ${res.status}`);
    const loc = res.headers.get("location") || "";
    assert(loc.includes(`ref=${partnerCode}`), `Should include ref param, got: ${loc}`);
    const cookie = res.headers.get("set-cookie") || "";
    assert(cookie.includes("affiliateswarm_ref"), `Should set affiliateswarm_ref cookie`);
  });

  await test("GET /affiliate/skill.md?ref=CODE — injects partnerCode", async () => {
    const res = await fetch(`${BASE_URL}/affiliate/skill.md?ref=${partnerCode}`);
    const text = await res.text();
    assert(text.includes(`"partnerCode": "${partnerCode}"`), "Should inject partner code");
    assert(!text.includes("OPTIONAL_PARTNER_CODE"), "Should replace placeholder");
  });

  await test("GET /affiliate/skill.md (no ref) — keeps placeholder", async () => {
    const res = await fetch(`${BASE_URL}/affiliate/skill.md`);
    const text = await res.text();
    assert(text.includes("OPTIONAL_PARTNER_CODE"), "Should keep placeholder");
  });

  // ── 3. Auth ──
  console.log("\n3. Auth\n");

  await test("GET /api/v1/me — advertiser auth works", async () => {
    const { status, json } = await api("GET", "/api/v1/me", undefined, advKey);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(json.data.agent.id === advId, "Agent ID should match");
  });

  await test("GET /api/v1/me — affiliate auth works", async () => {
    const { status, json } = await api("GET", "/api/v1/me", undefined, affKey);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(json.data.agent.id === affId, "Agent ID should match");
  });

  await test("GET /api/v1/me — rejects bad key", async () => {
    const { status } = await api("GET", "/api/v1/me", undefined, "swarm_live_badkey");
    assert(status === 401, `Expected 401, got ${status}`);
  });

  // ── 4. Campaign Discovery ──
  console.log("\n4. Campaign Discovery\n");

  await test("GET /api/v1/discover/campaigns — returns active campaigns", async () => {
    const { status, json } = await api("GET", "/api/v1/discover/campaigns", undefined, affKey);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(json.data.length > 0, "Should have at least 1 campaign");
    const names = json.data.map((c: any) => c.name);
    assert(names.some((n: string) => n.includes("E2E Test")), "Should include E2E test campaign");
  });

  await test("GET /api/v1/discover/campaigns?compensationModel=CPA — filter works", async () => {
    const { status, json } = await api("GET", "/api/v1/discover/campaigns?compensationModel=CPA", undefined, affKey);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(json.data.every((c: any) => c.compensationModel === "CPA"), "All should be CPA");
  });

  // ── 5. Affiliate Enrollment ──
  console.log("\n5. Affiliate Enrollment\n");

  let trackingCode = "";

  await test("POST /api/v1/campaigns/:id/applications — affiliate applies (OPEN = auto-approve)", async () => {
    const { status, json } = await api("POST", `/api/v1/campaigns/${campaignId}/applications`, {
      pitch: "E2E test affiliate",
    }, affKey);
    assert(status === 200 || status === 201, `Expected 200/201, got ${status}: ${JSON.stringify(json)}`);
    trackingCode = json.data.trackingCode;
    assert(!!trackingCode, "Should return tracking code");
  });

  // ── 6. Click Tracking ──
  console.log("\n6. Click Tracking\n");

  await test("GET /t/:trackingCode — redirect with ref param", async () => {
    const res = await fetch(`${BASE_URL}/t/${trackingCode}`, { redirect: "manual" });
    assert(res.status === 302 || res.status === 307, `Expected redirect, got ${res.status}`);
    const loc = res.headers.get("location") || "";
    assert(loc.includes(`ref=${trackingCode}`), `Should include ref, got: ${loc}`);
  });

  // ── 7. Postback (Conversion) ──
  console.log("\n7. Postback\n");

  await test("POST /api/v1/postback — conversion tracked and verified", async () => {
    const { status, json } = await api("POST", "/api/v1/postback", {
      swarm_ref: trackingCode,
      externalId: `e2e-${Date.now()}`,
      eventType: "PURCHASE",
      revenueCents: 5000,
    }, advKey);
    assert(status === 200 || status === 201, `Expected 200/201, got ${status}: ${JSON.stringify(json)}`);
    assert(json.data.status === "VERIFIED", `Should be VERIFIED, got ${json.data.status}`);
    assert(json.data.payoutCents === 1000, `Payout should be 1000 ($10), got ${json.data.payoutCents}`);
  });

  await test("POST /api/v1/postback — idempotent on same externalId", async () => {
    const extId = `e2e-idem-${Date.now()}`;
    await api("POST", "/api/v1/postback", { swarm_ref: trackingCode, externalId: extId, eventType: "PURCHASE", revenueCents: 3000 }, advKey);
    const { status, json } = await api("POST", "/api/v1/postback", { swarm_ref: trackingCode, externalId: extId, eventType: "PURCHASE", revenueCents: 3000 }, advKey);
    assert(status === 200, `Second call should be 200, got ${status}`);
  });

  // ── 8. Affiliate Earnings ──
  console.log("\n8. Affiliate Earnings\n");

  await test("Affiliate wallet has balance (full payout, fee is on advertiser)", async () => {
    const { status, json } = await api("GET", `/api/v1/wallets/${affId}`, undefined, affKey);
    assert(status === 200, `Expected 200, got ${status}`);
    // $10 CPA = 1000 cents per conversion — platform fee is charged to advertiser at allocation
    assert(json.data.availableCents > 0, `Should have positive balance, got ${json.data.availableCents}`);
  });

  await test("Campaign budget spent updated", async () => {
    const { status, json } = await api("GET", `/api/v1/campaigns/${campaignId}`, undefined, advKey);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(json.data.budgetSpentCents > 0, `Budget spent should be > 0, got ${json.data.budgetSpentCents}`);
  });

  // ── 9. Partner Revenue Share ──
  console.log("\n9. Partner Revenue Share\n");

  await test("Partner earned credit from affiliate's conversion", async () => {
    const { status, json } = await api("GET", `/api/v1/partners/stats?code=${partnerCode}`);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(json.data.partner.totalEarnedCents > 0, `Partner should have earned, got ${json.data.partner.totalEarnedCents}`);
    assert(json.data.referrals.total >= 1, `Should have referrals, got ${json.data.referrals.total}`);
  });

  // ── 10. Analytics ──
  console.log("\n10. Analytics\n");

  await test("GET /api/v1/analytics/overview — advertiser stats", async () => {
    const { status, json } = await api("GET", "/api/v1/analytics/overview", undefined, advKey);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(typeof json.data.totalLeads === "number", "Should have totalLeads");
  });

  await test("GET /api/v1/onboarding/status — shows progress", async () => {
    const { status, json } = await api("GET", "/api/v1/onboarding/status", undefined, advKey);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(json.data.steps.length > 0, "Should have onboarding steps");
  });

  // ── 11. New Agent Registration with Referral ──
  console.log("\n11. New Agent Registration with Referral\n");

  await test("Register new agent with partnerCode — referral tracked", async () => {
    const { status, json } = await api("POST", "/api/v1/agents", {
      displayName: `E2E-New-${Date.now()}`,
      type: "AFFILIATE",
      email: `e2e-new-${Date.now()}@test.affiliateswarm.dev`,
      partnerCode,
    });
    assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(json)}`);

    // Verify partner referral count went up
    const { json: statsJson } = await api("GET", `/api/v1/partners/stats?code=${partnerCode}`);
    assert(statsJson.data.referrals.total >= 2, `Should have 2+ referrals, got ${statsJson.data.referrals.total}`);
  });

  // ── 12. Login Code ──
  console.log("\n12. Login Code\n");

  await test("Generate and verify login code", async () => {
    const { status, json } = await api("POST", "/api/v1/auth/login-code", {}, advKey);
    assert(status === 200, `Expected 200, got ${status}`);
    const code = json.data.code;
    assert(code && code.length === 6, `Should be 6-char code, got: ${code}`);

    // Verify the code
    const res = await fetch(`${BASE_URL}/api/auth/verify-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      redirect: "manual",
    });
    assert(res.status === 200, `Verify should return 200, got ${res.status}`);
    const cookie = res.headers.get("set-cookie") || "";
    assert(cookie.includes("session"), "Should set session cookie");

    // Code is single-use
    const { status: reuse } = await api("POST", "/api/auth/verify-code", { code });
    assert(reuse === 401, `Reused code should be 401, got ${reuse}`);
  });

  // ── 13. Error Handling ──
  console.log("\n13. Error Handling\n");

  await test("404 on non-existent lead", async () => {
    const { status } = await api("GET", "/api/v1/leads/00000000-0000-0000-0000-000000000000", undefined, advKey);
    assert(status === 404, `Expected 404, got ${status}`);
  });

  await test("400 on invalid campaign creation", async () => {
    const { status } = await api("POST", "/api/v1/campaigns", { description: "missing fields" }, advKey);
    assert(status === 400, `Expected 400, got ${status}`);
  });

  await test("400 on registration without email", async () => {
    const { status } = await api("POST", "/api/v1/agents", { displayName: "No Email", type: "AFFILIATE" });
    assert(status === 400, `Expected 400, got ${status}`);
  });

  // ── Results ──
  console.log("\n" + "=".repeat(60));
  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error("E2E crashed:", e); process.exit(1); });
