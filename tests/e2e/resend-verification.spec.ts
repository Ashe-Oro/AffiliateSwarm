/**
 * E2E — Self-serve resend verification email.
 *
 * Tests:
 *   1. API endpoint: POST /api/v1/agents/:agentId/resend-verification
 *   2. Dashboard UI: resend button on settings page for unverified agents
 *
 * Requires a running Next.js server on BASE_URL (default: http://localhost:3099).
 */

import { test, expect } from "@playwright/test";
import { api, registerAgent, loginViaBrowser } from "./helpers";

const RUN_ID = Date.now();

const state: {
  advertiser?: { agentId: string; apiKey: string };
  affiliate?: { agentId: string; apiKey: string };
} = {};

test.describe.configure({ mode: "serial" });

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1: API ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════

test.describe("API: Resend Verification", () => {
  test("setup — register unverified advertiser", async () => {
    state.advertiser = await registerAgent(
      `Resend Adv ${RUN_ID}`,
      "ADVERTISER",
      `resend-adv-${RUN_ID}@test.affiliateswarm.dev`
    );
    expect(state.advertiser.agentId).toBeTruthy();
  });

  test("resends verification email for own agent", async () => {
    const { status, json } = await api(
      "POST",
      `/api/v1/agents/${state.advertiser!.agentId}/resend-verification`,
      undefined,
      state.advertiser!.apiKey
    );

    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.ok).toBe(true);
    expect(json.data.email).toBeTruthy();
    expect(json.data.expiresAt).toBeTruthy();
  });

  test("rejects resend for a different agent", async () => {
    // Register a second agent
    state.affiliate = await registerAgent(
      `Resend Aff ${RUN_ID}`,
      "AFFILIATE",
      `resend-aff-${RUN_ID}@test.affiliateswarm.dev`
    );

    // Try to resend the affiliate's verification using the advertiser's key
    const { status, json } = await api(
      "POST",
      `/api/v1/agents/${state.affiliate!.agentId}/resend-verification`,
      undefined,
      state.advertiser!.apiKey
    );

    expect(status).toBe(403);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("FORBIDDEN");
  });

  test("rejects unauthenticated requests", async () => {
    const { status, json } = await api(
      "POST",
      `/api/v1/agents/${state.advertiser!.agentId}/resend-verification`
    );

    expect(status).toBe(401);
    expect(json.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: DASHBOARD UI
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Dashboard: Resend Verification Button", () => {
  test("advertiser settings page shows resend button for unverified agent", async ({
    page,
  }) => {
    // Log in via browser
    await loginViaBrowser(page, state.advertiser!.apiKey);

    // Navigate to settings
    await page.goto(
      `${process.env.BASE_URL || "http://localhost:3099"}/dashboard/settings`
    );
    await page.waitForLoadState("networkidle");

    // Verify the "email unverified" badge is visible
    await expect(page.getByText("email unverified")).toBeVisible();

    // Verify the resend button is visible
    const resendButton = page.getByRole("button", {
      name: /resend verification email/i,
    });
    await expect(resendButton).toBeVisible();

    // Click the resend button
    await resendButton.click();

    // Wait for success message
    await expect(
      page.getByText(/verification email sent to/i)
    ).toBeVisible({ timeout: 10000 });
  });
});
