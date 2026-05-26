import { NextRequest, NextResponse } from "next/server";
import { shopifyEnv } from "@/lib/shopify/env";
import { findShopByDomain } from "@/services/shopify-app";
import { requireSessionToken } from "@/services/shopify-app/admin-api-auth";

/**
 * POST /shopify/admin/api/test-postback
 * Body: { testTrackingCode: string }
 *
 * Fires a test postback to AffiliateSwarm using the campaign's
 * testTrackingCode. The AffiliateSwarm side treats this as a confirmation
 * (no real lead, no escrow movement) and flips trackingConfirmedAt on the
 * matching campaign.
 */

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = requireSessionToken(req);
  if (auth instanceof NextResponse) return auth;
  const { shopDomain } = auth;

  const body = (await req.json().catch(() => ({}))) as { testTrackingCode?: unknown };
  const testTrackingCode = typeof body.testTrackingCode === "string" ? body.testTrackingCode.trim() : "";
  if (!testTrackingCode) {
    return NextResponse.json({ ok: false, message: "Paste the testTrackingCode from your AffiliateSwarm campaign first." });
  }

  const shop = await findShopByDomain(shopDomain);
  if (!shop?.advertiserApiKey) {
    return NextResponse.json({ ok: false, message: "Save a valid AffiliateSwarm API key first." });
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
      return NextResponse.json({ ok: true, message: "Test postback accepted. Your campaign is tracking-confirmed." });
    }
    const text = await res.text();
    return NextResponse.json({ ok: false, message: `AffiliateSwarm rejected the test: ${text.slice(0, 200)}` });
  } catch (err) {
    return NextResponse.json({ ok: false, message: `Failed to reach AffiliateSwarm: ${err instanceof Error ? err.message : "unknown error"}` });
  }
}
