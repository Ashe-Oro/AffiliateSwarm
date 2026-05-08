import { test, expect } from "@playwright/test";
import {
  registerAgent,
  verifyAgentEmail,
  loginViaBrowser,
  creditWallet,
} from "./helpers";

test.describe("Campaign creation dashboard flow", () => {
  test.describe.configure({ mode: "serial" });

  const state: {
    advertiser?: { agentId: string; apiKey: string };
  } = {};

  test("setup: register and verify advertiser", async () => {
    const uniqueSuffix = Date.now();
    const advertiser = await registerAgent(
      `E2E Campaign Create Test ${uniqueSuffix}`,
      "ADVERTISER",
      `e2e-campaign-create-${uniqueSuffix}@test.local`
    );
    await verifyAgentEmail(advertiser.agentId);
    state.advertiser = advertiser;
  });

  test("create campaign via dashboard redirects to campaign detail page", async ({
    page,
  }) => {
    const { agentId, apiKey } = state.advertiser!;

    // Credit wallet so the advertiser has funds (not strictly required for create,
    // but mirrors the real advertiser onboarding flow)
    await creditWallet(agentId, 1_000_00);

    // Log in and navigate to the create campaign page
    await loginViaBrowser(page, apiKey, "/dashboard/campaigns/new");
    await expect(page).toHaveURL(/\/dashboard\/campaigns\/new/);

    // Regression guard for #199: the create form must not surface a
    // Conversion Window field. Regatta does not set cookies or enforce
    // attribution windows — the advertiser's own site owns that.
    await expect(
      page.getByLabel(/Conversion Window/i)
    ).toHaveCount(0);
    await expect(page.getByText(/Conversion Window/i)).toHaveCount(0);

    // Capture the form for PR screenshot evidence.
    await page.screenshot({
      path: "test-results/issue-199-campaign-new.png",
      fullPage: true,
    });

    // Fill out the campaign form
    await page.getByLabel("Name").fill("E2E Test Campaign");
    await page.getByLabel("Description").fill("Created by Playwright e2e test");
    await page.getByLabel("Payout per Unit ($)").fill("5.00");
    await page.getByLabel("Budget ($)").fill("1000.00");
    await page.getByLabel("Landing URL").fill("https://example.com/offer");

    // Enable buyer incentive section
    await page.getByLabel("Offer a buyer incentive").check();
    await expect(page.getByLabel("Incentive Type")).toBeVisible();
    await page.getByLabel("Incentive Type").selectOption("PERCENTAGE_OFF");
    await page.getByLabel("Discount (%)").fill("20");
    await page.getByLabel("Display Label").fill("20% off your first month");
    await page.getByLabel("Coupon Code").fill("E2ETEST20");

    // Submit
    await page.getByRole("button", { name: "Create Campaign" }).click();

    // Wait for redirect — should go to /dashboard/campaigns/<uuid>, NOT /dashboard/campaigns/undefined
    await page.waitForURL(
      (url) => {
        const path = url.pathname;
        return (
          path.startsWith("/dashboard/campaigns/") &&
          path !== "/dashboard/campaigns/new" &&
          !path.includes("undefined")
        );
      },
      { timeout: 15_000 }
    );

    // Verify we landed on a valid campaign detail page
    const url = page.url();
    const campaignId = url.split("/dashboard/campaigns/")[1];
    expect(campaignId).toBeTruthy();
    expect(campaignId).not.toBe("undefined");

    // Verify the detail page rendered (not an error page)
    await expect(
      page.getByText("E2E Test Campaign")
    ).toBeVisible({ timeout: 5_000 });

    // Regression guard for #199: the campaign detail page must not
    // display a Conversion Window row.
    await expect(
      page.getByText(/Conversion Window/i)
    ).toHaveCount(0);

    // Capture the detail page for PR screenshot evidence.
    await page.screenshot({
      path: "test-results/issue-199-campaign-detail.png",
      fullPage: true,
    });
  });
});
