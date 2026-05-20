"use server";

import { logger } from "@/lib/logger";
import { shopifyEnv } from "@/lib/shopify/env";
import { findShopByDomain, isValidShopDomain, setAdvertiserApiKey } from "@/services/shopify-app";

/**
 * Server actions backing the embedded admin page.
 *
 * - saveApiKeyAction: validates the pasted advertiser API key by hitting
 *   /api/v1/me, then persists it (encrypted) and records the validation result.
 * - testConnectionAction: fires a test postback using the campaign's
 *   testTrackingCode so the merchant can prove end-to-end attribution
 *   without a real order. Requires a campaignId.
 */

export interface SaveApiKeyResult {
  ok: boolean;
  error?: string;
}

export async function saveApiKeyAction(formData: FormData): Promise<SaveApiKeyResult> {
  const shopDomain = String(formData.get("shop") ?? "").trim().toLowerCase();
  const apiKey = String(formData.get("apiKey") ?? "").trim();

  if (!isValidShopDomain(shopDomain)) {
    return { ok: false, error: "Invalid shop domain" };
  }
  if (!apiKey || !apiKey.startsWith("swarm_")) {
    return { ok: false, error: "API key must start with 'swarm_'" };
  }

  const shop = await findShopByDomain(shopDomain);
  if (!shop) {
    return { ok: false, error: "Shop is not installed" };
  }

  let valid = false;
  let advertiserAgentId: string | null = null;
  try {
    const res = await fetch(`${shopifyEnv.affiliateswarmApiBase()}/api/v1/me`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    if (res.ok) {
      valid = true;
      const body = (await res.json()) as { data?: { agent?: { id?: string } } };
      advertiserAgentId = body.data?.agent?.id ?? null;
    }
  } catch (err) {
    logger.warn({ err, shopDomain, action: "shopify_admin_validate_api_key" }, "API key validation failed");
  }

  await setAdvertiserApiKey(shopDomain, apiKey, valid, advertiserAgentId);

  if (!valid) {
    return { ok: false, error: "Key saved, but AffiliateSwarm rejected it. Double-check it on affiliateswarm.ai." };
  }
  return { ok: true };
}

export interface TestConnectionResult {
  ok: boolean;
  message: string;
}

export async function testConnectionAction(formData: FormData): Promise<TestConnectionResult> {
  const shopDomain = String(formData.get("shop") ?? "").trim().toLowerCase();
  const testTrackingCode = String(formData.get("testTrackingCode") ?? "").trim();

  if (!isValidShopDomain(shopDomain)) {
    return { ok: false, message: "Invalid shop domain" };
  }
  if (!testTrackingCode) {
    return { ok: false, message: "Paste the testTrackingCode from your AffiliateSwarm campaign first." };
  }

  const shop = await findShopByDomain(shopDomain);
  if (!shop?.advertiserApiKey) {
    return { ok: false, message: "Save a valid AffiliateSwarm API key first." };
  }

  try {
    const res = await fetch(`${shopifyEnv.affiliateswarmApiBase()}/api/v1/postback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${shop.advertiserApiKey}`,
      },
      body: JSON.stringify({
        swarm_ref: testTrackingCode,
        externalId: `shopify_test_${Date.now()}`,
        eventType: "PURCHASE",
        revenueCents: 100,
      }),
    });
    if (res.ok) {
      return { ok: true, message: "Test postback accepted. Your campaign is tracking-confirmed." };
    }
    const body = await res.text();
    return { ok: false, message: `AffiliateSwarm rejected the test: ${body.slice(0, 200)}` };
  } catch (err) {
    return { ok: false, message: `Failed to reach AffiliateSwarm: ${err instanceof Error ? err.message : "unknown error"}` };
  }
}
