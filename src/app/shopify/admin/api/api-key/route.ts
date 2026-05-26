import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { shopifyEnv } from "@/lib/shopify/env";
import { findShopByDomain, setAdvertiserApiKey } from "@/services/shopify-app";
import { requireSessionToken } from "@/services/shopify-app/admin-api-auth";

/**
 * POST /shopify/admin/api/api-key
 * Body: { apiKey: string }
 *
 * Validates the pasted AffiliateSwarm advertiser API key against /api/v1/me,
 * then persists it (encrypted) on the shop row along with the resolved
 * advertiser agent id for the dashboard lookup.
 */

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = requireSessionToken(req);
  if (auth instanceof NextResponse) return auth;
  const { shopDomain } = auth;

  const body = (await req.json().catch(() => ({}))) as { apiKey?: unknown };
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

  if (!apiKey || !apiKey.startsWith("swarm_")) {
    return NextResponse.json({ ok: false, error: "API key must start with 'swarm_'" }, { status: 400 });
  }

  const shop = await findShopByDomain(shopDomain);
  if (!shop) {
    return NextResponse.json({ ok: false, error: "shop not provisioned yet" }, { status: 404 });
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
      const meBody = (await res.json()) as { data?: { agent?: { id?: string } } };
      advertiserAgentId = meBody.data?.agent?.id ?? null;
    }
  } catch (err) {
    logger.warn({ err, shopDomain, action: "shopify_admin_validate_api_key" }, "API key validation failed");
  }

  await setAdvertiserApiKey(shopDomain, apiKey, valid, advertiserAgentId);

  if (!valid) {
    return NextResponse.json(
      { ok: false, error: "Key saved, but AffiliateSwarm rejected it. Double-check it on affiliateswarm.ai." },
      { status: 200 },
    );
  }
  return NextResponse.json({ ok: true });
}
