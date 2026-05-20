import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { shopifyEnv } from "@/lib/shopify/env";
import { verifyWebhookHmac } from "@/services/shopify-app";

/**
 * GDPR — customers/data_request
 *
 * We never store customer PII for Shopify orders (we only persist order IDs,
 * swarm_ref strings, and revenue cents). Acknowledge the request so Shopify
 * marks the app compliant; nothing to export.
 */

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const hmac = req.headers.get("X-Shopify-Hmac-SHA256");
  if (!verifyWebhookHmac(rawBody, hmac, shopifyEnv.apiSecret())) {
    return new NextResponse("invalid hmac", { status: 401 });
  }
  logger.info({ shopDomain: req.headers.get("X-Shopify-Shop-Domain"), action: "shopify_gdpr_data_request" }, "gdpr data request — no PII stored");
  return NextResponse.json({ ok: true, message: "No customer PII stored by this app." });
}
