/**
 * Shared helpers for E2E tests.
 * Provides an API client and seed/teardown utilities.
 */
import type { Page, BrowserContext } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3099";

// ── API Client ──────────────────────────────────────────────────────────

export interface ApiResponse {
  status: number;
  json: any;
  text: string;
  headers: Headers;
}

export async function api(
  method: string,
  path: string,
  body?: any,
  apiKey?: string
): Promise<ApiResponse> {
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
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text, headers: res.headers };
}

// ── Agent Registration ──────────────────────────────────────────────────

export interface AgentCredentials {
  agentId: string;
  apiKey: string;
  depositAddress: string | null;
  type: "ADVERTISER" | "AFFILIATE";
}

export interface AffiliateProfile {
  audienceSize?: number;
  channels?: string[];
  contentType?: string;
  relevantUrls?: string[];
  audienceGeo?: string;
}

export async function registerAgent(
  displayName: string,
  type: "ADVERTISER" | "AFFILIATE",
  email: string,
  options?: { partnerCode?: string; profile?: AffiliateProfile }
): Promise<AgentCredentials> {
  const { status, json } = await api("POST", "/api/v1/agents", {
    displayName,
    type,
    email,
    ...(options?.partnerCode && { partnerCode: options.partnerCode }),
    ...(options?.profile && options.profile),
  });

  if (status !== 201) {
    throw new Error(`Failed to register ${type}: ${status} ${JSON.stringify(json)}`);
  }

  return {
    agentId: json.data.agent.id,
    apiKey: json.data.apiKey,
    depositAddress: json.data.wallet?.depositAddress ?? null,
    type,
  };
}

// ── Verify Email (simulate clicking verification link) ──────────────────

/**
 * Verify an agent's email by calling the verify-email endpoint.
 * In tests, we fetch the token directly from the DB via an internal test endpoint.
 */
export async function verifyAgentEmail(agentId: string): Promise<void> {
  // Use the test-only endpoint to get the verification token and verify
  const { status, json } = await api("POST", "/api/test/verify-email", { agentId });
  if (status !== 200) {
    throw new Error(`Failed to verify email: ${status} ${JSON.stringify(json)}`);
  }
}

// ── Campaign Setup ──────────────────────────────────────────────────────

export async function createCampaign(
  apiKey: string,
  overrides?: Record<string, any>
) {
  const { status, json } = await api(
    "POST",
    "/api/v1/campaigns",
    {
      name: `E2E Campaign ${Date.now()}`,
      compensationModel: "CPA",
      payoutPerUnitCents: 1000,
      budgetCents: 500000,
      landingUrl: "https://example.com/signup",
      productUrl: "https://example.com",
      conversionAction: "paid_subscription",
      productDescription: "E2E test product for automated testing",
      enrollmentPolicy: "OPEN",
      ...overrides,
    },
    apiKey
  );

  if (status !== 201) {
    throw new Error(`Failed to create campaign: ${status} ${JSON.stringify(json)}`);
  }

  return {
    campaignId: json.data.campaign.id as string,
    escrowAccountId: json.data.escrowAccount.id as string,
    testTrackingCode: json.data.campaign.testTrackingCode as string,
  };
}

// ── Credit Wallet (test-only, simulates deposit) ────────────────────────

export async function creditWallet(agentId: string, amountCents: number) {
  const { status, json } = await api(
    "POST",
    "/api/test/credit-wallet",
    { agentId, amountCents }
  );

  if (status !== 200) {
    throw new Error(`Failed to credit wallet: ${status} ${JSON.stringify(json)}`);
  }
  return json.data;
}

// ── Fund Advertiser Wallet ─────────────────────────────────────────────

const CARD_FEE_RATE = 0.03;

/**
 * Credit the advertiser's wallet. Campaigns auto-draw from this balance at
 * conversion time (up to each campaign's budgetCents cap), so no explicit
 * allocation step is needed. Takes the campaignId for signature-compat with
 * older call sites but ignores it — kept unused so tests can thread the id
 * through for context.
 */
export async function fundAdvertiserWallet(
  agentId: string,
  _apiKey: string,
  _campaignId: string,
  amountCents: number
) {
  return creditWallet(agentId, amountCents);
}


// ── Confirm Tracking (CONFIRM postback) ─────────────────────────────────

/**
 * Fire a CONFIRM postback against the campaign's testTrackingCode. This is
 * what advertisers must do in production to prove their integration works
 * before their campaign can be activated.
 */
export async function confirmTracking(apiKey: string, testTrackingCode: string) {
  const { status, json } = await api(
    "POST",
    "/api/v1/postback",
    {
      rgta_ref: testTrackingCode,
      externalId: `regatta-confirm-${Date.now()}`,
      eventType: "PURCHASE",
    },
    apiKey
  );
  if (status !== 200 && status !== 201) {
    throw new Error(`Failed to fire CONFIRM postback: ${status} ${JSON.stringify(json)}`);
  }
  return json.data;
}

// ── Activate Campaign ───────────────────────────────────────────────────

export async function activateCampaign(apiKey: string, campaignId: string) {
  const { status, json } = await api(
    "POST",
    `/api/v1/campaigns/${campaignId}/activate`,
    {},
    apiKey
  );
  if (status !== 200) {
    throw new Error(`Failed to activate campaign: ${status} ${JSON.stringify(json)}`);
  }
}

// ── Apply to Campaign ───────────────────────────────────────────────────

export async function applyToCampaign(
  apiKey: string,
  campaignId: string,
  pitch?: string
) {
  const { status, json } = await api(
    "POST",
    `/api/v1/campaigns/${campaignId}/applications`,
    { pitch: pitch ?? "E2E test affiliate" },
    apiKey
  );
  if (status !== 200 && status !== 201) {
    throw new Error(`Failed to apply: ${status} ${JSON.stringify(json)}`);
  }
  return {
    enrollmentId: json.data.id as string,
    trackingCode: json.data.trackingCode as string,
    status: json.data.status as string,
  };
}

// ── Login Code & Browser Auth ───────────────────────────────────────────

export async function getLoginCode(apiKey: string): Promise<string> {
  const { status, json } = await api("POST", "/api/v1/auth/login-code", {}, apiKey);
  if (status !== 200) {
    throw new Error(`Failed to get login code: ${status} ${JSON.stringify(json)}`);
  }
  return json.data.code;
}

/**
 * Log into the dashboard via the login code flow in a Playwright page.
 */
export async function loginViaBrowser(page: Page, apiKey: string, redirectTo?: string) {
  const code = await getLoginCode(apiKey);
  const loginUrl = redirectTo
    ? `${BASE_URL}/login?redirect=${encodeURIComponent(redirectTo)}`
    : `${BASE_URL}/login`;
  await page.goto(loginUrl);
  await page.getByLabel("Login Code").fill(code);
  await page.getByRole("button", { name: "Log in" }).click();
  // Wait for redirect to complete
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10_000 });
}

/**
 * Set up admin access by setting the ADMIN_SECRET cookie.
 */
export async function setupAdminAuth(context: BrowserContext) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    throw new Error("ADMIN_SECRET env var required for admin tests");
  }
  await context.addCookies([
    {
      name: "regatta_admin_token",
      value: adminSecret,
      domain: "localhost",
      path: "/",
    },
  ]);
}

// ── Mock Landing Page URL ──────────────────────────────────────────────

/** Landing URL that points to the mock advertiser website (test-only route). */
export const MOCK_LANDING_URL = `${BASE_URL}/api/test/mock-landing`;

// ── Stripe Checkout (real Stripe test mode) ────────────────────────────

/**
 * Create a Stripe checkout session via the API and return the checkout URL
 * and the Stripe session ID (for later processing).
 */
export async function createStripeCheckout(
  agentId: string,
  apiKey: string,
  campaignId: string,
  amountCents: number,
  paymentMethod: "card" | "ach" = "card"
) {
  const { status, json } = await api(
    "POST",
    `/api/v1/wallets/${agentId}/deposits/stripe`,
    { campaignId, amountCents, paymentMethod },
    apiKey
  );

  if (status !== 201) {
    throw new Error(`Failed to create Stripe checkout: ${status} ${JSON.stringify(json)}`);
  }

  return {
    checkoutUrl: json.data.url as string,
    checkoutId: json.data.checkoutId as string,
  };
}

/**
 * Complete a Stripe checkout session using Playwright.
 * Fills in the test card (4242 4242 4242 4242), submits payment,
 * and waits for the redirect back to the success page.
 *
 * Returns the Stripe session ID extracted from the success URL.
 */
export async function completeStripeCheckout(
  page: Page,
  checkoutUrl: string
): Promise<string> {
  await page.goto(checkoutUrl);

  // Wait for the card number field to appear (direct inputs on hosted checkout)
  await page.waitForSelector("#cardNumber", { timeout: 15_000 });

  // Fill email
  await page.locator("#email").fill("e2e-test@regatta.dev");

  // Fill card details
  await page.locator("#cardNumber").fill("4242424242424242");
  await page.locator("#cardExpiry").fill("12/30");
  await page.locator("#cardCvc").fill("123");
  await page.locator("#billingName").fill("E2E Test");

  const zipInput = page.locator("#billingPostalCode");
  if (await zipInput.isVisible({ timeout: 1000 }).catch(() => false)) {
    await zipInput.fill("10001");
  }

  // Uncheck "Save my information" if present — avoids phone number requirement
  const saveCheckbox = page.locator("#enableStripePass");
  if (await saveCheckbox.isVisible({ timeout: 1000 }).catch(() => false)) {
    const isChecked = await saveCheckbox.isChecked();
    if (isChecked) {
      await saveCheckbox.click();
    }
  }

  // Click the Pay button
  const payButton = page.locator('[data-testid="hosted-payment-submit-button"]');
  await payButton.click();

  // Wait for Stripe to process and redirect away from checkout.stripe.com
  await page.waitForURL(
    (url) => !url.hostname.includes("stripe.com"),
    { timeout: 45_000 }
  );

  // Extract session_id from the URL if available
  const finalUrl = new URL(page.url());
  let sessionId = finalUrl.searchParams.get("session_id");

  // If login redirect stripped query params, try the redirect param
  if (!sessionId) {
    const redirect = finalUrl.searchParams.get("redirect") ?? "";
    try {
      const redirectUrl = new URL(`http://localhost${redirect}`);
      sessionId = redirectUrl.searchParams.get("session_id");
    } catch {
      // redirect param wasn't a valid URL path
    }
  }

  // sessionId may be null if auth redirect stripped it — caller can use
  // the checkoutId from createStripeCheckout() instead
  return sessionId ?? "";
}

/**
 * Process a completed Stripe checkout session via the test endpoint.
 * This replaces waiting for the Stripe webhook, which may not reach localhost.
 */
export async function processStripeCheckout(stripeSessionId: string) {
  const { status, json } = await api(
    "POST",
    "/api/test/process-stripe-checkout",
    { stripeSessionId }
  );

  if (status !== 200) {
    throw new Error(`Failed to process Stripe checkout: ${status} ${JSON.stringify(json)}`);
  }
  return json;
}

/**
 * Full Stripe funding flow: create session → complete in browser → process webhook.
 * Returns when the escrow is credited.
 *
 * Falls back to direct deposit if STRIPE_SECRET_KEY is not configured.
 */
export async function fundCampaignViaStripe(
  page: Page,
  agentId: string,
  apiKey: string,
  campaignId: string,
  amountCents: number
) {
  const { checkoutUrl } = await createStripeCheckout(
    agentId, apiKey, campaignId, amountCents, "card"
  );

  // Extract Stripe session ID from the checkout URL (cs_test_... before the # fragment)
  const urlPath = checkoutUrl.split("#")[0];
  const stripeSessionIdFromUrl = urlPath.split("/pay/")[1] ?? "";

  // Complete the checkout in the browser (fills card, submits)
  const stripeSessionIdFromRedirect = await completeStripeCheckout(page, checkoutUrl);

  // Use the session ID from the redirect URL if available, otherwise from the checkout URL
  const stripeSessionId = stripeSessionIdFromRedirect || stripeSessionIdFromUrl;

  if (!stripeSessionId) {
    throw new Error("Could not determine Stripe session ID");
  }

  await processStripeCheckout(stripeSessionId);

  // Deposits go to wallet; campaigns auto-draw from there at conversion
  // time. `campaignId` stays in the signature for test ergonomics even
  // though funding is no longer campaign-scoped. Card fee is 3%, so net
  // credited to wallet = amountCents * 0.97.
  void campaignId;
  void apiKey;
  void CARD_FEE_RATE;
}

// ── Tracking Link Helpers ──────────────────────────────────────────────

/**
 * Follow a tracking link and return the redirect destination + extracted ref.
 * Does NOT follow the redirect (uses manual redirect mode).
 */
export async function followTrackingLink(trackingCode: string, landingUrl?: string) {
  const target = landingUrl
    ? `${landingUrl}${landingUrl.includes("?") ? "&" : "?"}rgta_ref=${trackingCode}`
    : `${MOCK_LANDING_URL}?rgta_ref=${trackingCode}`;
  const res = await fetch(target, { redirect: "manual" });
  return {
    status: res.status,
    location: target,
    ref: trackingCode,
  };
}

/**
 * Navigate directly to the advertiser's landing page with ?rgta_ref= appended,
 * the way a real user would after clicking an affiliate's link.
 */
export async function followTrackingLinkInBrowser(page: Page, trackingCode: string) {
  const url = `${MOCK_LANDING_URL}?rgta_ref=${trackingCode}`;
  await page.goto(url);
  const refElement = page.locator("#rgta-ref");
  const ref = await refElement.textContent();
  return { ref, url: page.url() };
}

// ── Postback (advertiser fires conversion) ─────────────────────────────

export async function firePostback(
  apiKey: string,
  ref: string,
  externalId: string,
  eventType: "PURCHASE" | "SIGNUP" | "INSTALL" | "SUBSCRIPTION" | "CUSTOM" = "PURCHASE",
  revenueCents?: number
) {
  const { status, json } = await api(
    "POST",
    "/api/v1/postback",
    {
      rgta_ref: ref,
      externalId,
      eventType,
      ...(revenueCents !== undefined && { revenueCents }),
    },
    apiKey
  );

  if (status !== 200 && status !== 201) {
    throw new Error(`Failed to fire postback: ${status} ${JSON.stringify(json)}`);
  }

  return {
    leadId: json.data.id as string,
    leadStatus: json.data.status as string,
    payoutCents: json.data.payoutCents as number,
    created: status === 201,
  };
}

// ── Wallet & Analytics ─────────────────────────────────────────────────

export async function getWalletBalance(apiKey: string) {
  const { status, json } = await api("GET", "/api/v1/wallets", undefined, apiKey);
  if (status !== 200) {
    throw new Error(`Failed to get wallet: ${status} ${JSON.stringify(json)}`);
  }
  return {
    availableCents: json.data.availableCents as number,
    pendingCents: json.data.pendingCents as number,
  };
}

export async function getAnalyticsOverview(apiKey: string) {
  const { status, json } = await api("GET", "/api/v1/analytics/overview", undefined, apiKey);
  if (status !== 200) {
    throw new Error(`Failed to get analytics: ${status} ${JSON.stringify(json)}`);
  }
  return json.data;
}

// ── Payout Request ────────────────────────────────────────────────────

export async function requestPayout(
  apiKey: string,
  amountCents: number,
  method: "CRYPTO" | "BANK_TRANSFER" | "PLATFORM_CREDIT" = "PLATFORM_CREDIT",
  destination?: Record<string, unknown>
) {
  const { status, json } = await api(
    "POST",
    "/api/v1/payouts",
    {
      amountCents,
      method,
      destination: destination ?? {},
    },
    apiKey
  );

  if (status !== 201) {
    throw new Error(`Failed to request payout: ${status} ${JSON.stringify(json)}`);
  }

  return {
    payoutId: json.data.id as string,
    status: json.data.status as string,
    amountCents: json.data.amountCents as number,
    method: json.data.method as string,
  };
}

export async function listPayouts(apiKey: string) {
  const { status, json } = await api("GET", "/api/v1/payouts", undefined, apiKey);
  if (status !== 200) {
    throw new Error(`Failed to list payouts: ${status} ${JSON.stringify(json)}`);
  }
  return json.data as any[];
}

// ── Conversions ───────────────────────────────────────────────────────

export async function listConversions(apiKey: string) {
  const { status, json } = await api("GET", "/api/v1/conversions", undefined, apiKey);
  if (status !== 200) {
    throw new Error(`Failed to list conversions: ${status} ${JSON.stringify(json)}`);
  }
  return json.data as any[];
}
