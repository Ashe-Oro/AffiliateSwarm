import { test, expect } from "@playwright/test";
import {
  registerAgent,
  verifyAgentEmail,
  loginViaBrowser,
  creditWallet,
  createCampaign,
  activateCampaign,
  confirmTracking,
  applyToCampaign,
  firePostback,
  followTrackingLink,
  api,
} from "./helpers";

/**
 * End-to-end coverage for the REV_SHARE compensation model.
 *
 * Verifies the full advertiser → affiliate → postback flow with
 * `compensationModel: "REV_SHARE"` + `payoutPercentage`, and the
 * validation guards that reject misuse.
 */
test.describe("REV_SHARE campaign lifecycle", () => {
  test.describe.configure({ mode: "serial" });

  const state: {
    advertiser?: { agentId: string; apiKey: string };
    affiliate?: { agentId: string; apiKey: string };
    campaignId?: string;
    trackingCode?: string;
    testTrackingCode?: string;
  } = {};

  test("setup: register and verify advertiser + affiliate", async () => {
    const suffix = Date.now();
    const advertiser = await registerAgent(
      `E2E RevShare Advertiser ${suffix}`,
      "ADVERTISER",
      `e2e-revshare-adv-${suffix}@test.local`
    );
    await verifyAgentEmail(advertiser.agentId);
    state.advertiser = advertiser;

    const affiliate = await registerAgent(
      `E2E RevShare Affiliate ${suffix}`,
      "AFFILIATE",
      `e2e-revshare-aff-${suffix}@test.local`
    );
    await verifyAgentEmail(affiliate.agentId);
    state.affiliate = affiliate;
  });

  test("create REV_SHARE campaign via dashboard shows Revenue Share input, persists payoutPercentage", async ({
    page,
  }) => {
    const { agentId, apiKey } = state.advertiser!;
    await creditWallet(agentId, 100_000_00);

    await loginViaBrowser(page, apiKey, "/dashboard/campaigns/new");
    await expect(page).toHaveURL(/\/dashboard\/campaigns\/new/);

    // Default model is CPL; the dollar-based payout field is visible.
    await expect(page.getByLabel("Payout per Unit ($)")).toBeVisible();

    // Switch to REV_SHARE. The form should swap inputs.
    await page.getByLabel("Compensation Model").selectOption("REV_SHARE");
    await expect(page.getByLabel("Revenue Share (%)")).toBeVisible();
    await expect(page.getByLabel("Payout per Unit ($)")).toHaveCount(0);

    // Fill and submit.
    await page.getByLabel("Name").fill("E2E RevShare Campaign");
    await page
      .getByLabel("Description")
      .fill("Created by Playwright revshare e2e");
    await page.getByLabel("Revenue Share (%)").fill("20");
    await page.getByLabel("Budget ($)").fill("500.00");
    await page.getByLabel("Landing URL").fill("https://example.com/offer");

    await page.screenshot({
      path: "test-results/revshare-campaign-form.png",
      fullPage: true,
    });

    await page.getByRole("button", { name: "Create Campaign" }).click();

    await page.waitForURL(
      (url) =>
        url.pathname.startsWith("/dashboard/campaigns/") &&
        !url.pathname.endsWith("/new"),
      { timeout: 10_000 }
    );

    // Detail page shows "20% of revenue", not a dollar amount.
    await expect(page.getByText(/20%\s*of revenue/i)).toBeVisible();

    await page.screenshot({
      path: "test-results/revshare-campaign-detail.png",
      fullPage: true,
    });

    // Extract the campaign id from the URL so later tests can use it.
    const url = new URL(page.url());
    const parts = url.pathname.split("/");
    state.campaignId = parts[parts.indexOf("campaigns") + 1];
  });

  test("API: REV_SHARE campaign rejects payoutPerUnitCents on create", async () => {
    const { apiKey } = state.advertiser!;
    const { status, json } = await api(
      "POST",
      "/api/v1/campaigns",
      {
        name: "Should Fail — bps with REV_SHARE",
        compensationModel: "REV_SHARE",
        payoutPerUnitCents: 500,
        payoutPercentage: 20,
        budgetCents: 10000,
        landingUrl: "https://example.com",
      },
      apiKey
    );
    expect(status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(json)).toMatch(/payoutPerUnitCents/);
  });

  test("API: REV_SHARE campaign rejects payoutPercentage above 100", async () => {
    const { apiKey } = state.advertiser!;
    const { status } = await api(
      "POST",
      "/api/v1/campaigns",
      {
        name: "Should Fail — 101%",
        compensationModel: "REV_SHARE",
        payoutPercentage: 101,
        budgetCents: 10000,
        landingUrl: "https://example.com",
      },
      apiKey
    );
    expect(status).toBeGreaterThanOrEqual(400);
  });

  test("postback: REV_SHARE without revenueCents returns 400", async () => {
    const { apiKey } = state.advertiser!;
    const { campaignId, testTrackingCode } = await createCampaign(apiKey, {
      name: `E2E RevShare API Campaign ${Date.now()}`,
      compensationModel: "REV_SHARE",
      payoutPercentage: 20,
      payoutPerUnitCents: undefined,
      budgetCents: 1_000_000,
    });
    await confirmTracking(apiKey, testTrackingCode);
    await activateCampaign(apiKey, campaignId);

    // Enroll affiliate
    const { apiKey: affKey } = state.affiliate!;
    const { trackingCode } = await applyToCampaign(affKey, campaignId);
    await followTrackingLink(trackingCode);

    // Fire postback without revenueCents — must 400.
    const { status, json } = await api(
      "POST",
      "/api/v1/postback",
      {
        swarm_ref: trackingCode,
        externalId: `missing-revenue-${Date.now()}`,
        eventType: "PURCHASE",
      },
      apiKey
    );
    expect(status).toBe(400);
    expect(JSON.stringify(json)).toMatch(/revenueCents/i);

    // Fire again with revenueCents — must succeed and payout = 20% of revenue.
    const result = await firePostback(
      apiKey,
      trackingCode,
      `ok-${Date.now()}`,
      "PURCHASE",
      10000 // $100.00 revenue → expected payout $20.00 = 2000 cents
    );
    expect(result.payoutCents).toBe(2000);

    state.campaignId = campaignId;
    state.trackingCode = trackingCode;
    state.testTrackingCode = testTrackingCode;
  });

  test("payout math: 20% of $14.99 rounds to $3.00", async () => {
    const { apiKey } = state.advertiser!;
    const { trackingCode } = { trackingCode: state.trackingCode! };

    const result = await firePostback(
      apiKey,
      trackingCode,
      `rounding-${Date.now()}`,
      "PURCHASE",
      1499 // $14.99 → 20% = $2.998 → rounds to $3.00 = 300 cents
    );
    expect(result.payoutCents).toBe(300);
  });

  test("API: PATCH rejects payoutPerUnitCents on REV_SHARE campaign", async () => {
    const { apiKey } = state.advertiser!;
    const { status, json } = await api(
      "PATCH",
      `/api/v1/campaigns/${state.campaignId}`,
      { payoutPerUnitCents: 500 },
      apiKey
    );
    expect(status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(json)).toMatch(/payoutPerUnitCents.*REV_SHARE/i);
  });
});
