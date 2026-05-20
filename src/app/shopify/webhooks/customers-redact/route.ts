import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { shopifyEnv } from "@/lib/shopify/env";
import { verifyWebhookHmac } from "@/services/shopify-app";

/**
 * GDPR — customers/redact
 *
 * No customer PII is stored, so there is nothing to redact. Ack only.
 */

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const hmac = req.headers.get("X-Shopify-Hmac-SHA256");
  if (!verifyWebhookHmac(rawBody, hmac, shopifyEnv.apiSecret())) {
    return new NextResponse("invalid hmac", { status: 401 });
  }
  logger.info({ shopDomain: req.headers.get("X-Shopify-Shop-Domain"), action: "shopify_gdpr_customers_redact" }, "gdpr customers redact — no PII stored");
  return NextResponse.json({ ok: true });
}
