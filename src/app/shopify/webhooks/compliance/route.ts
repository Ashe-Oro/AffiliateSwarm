import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { shopifyEnv } from "@/lib/shopify/env";
import { verifyWebhookHmac } from "@/services/shopify-app";

/**
 * POST /shopify/webhooks/compliance
 *
 * Single endpoint registered for all three GDPR compliance topics
 * (customers/data_request, customers/redact, shop/redact). Dispatches on
 * the X-Shopify-Topic header.
 *
 * We never store customer PII for Shopify orders — only order IDs,
 * swarm_ref strings, and revenue cents — so data_request and customers/redact
 * are stub acknowledgements. shop/redact additionally wipes the encrypted
 * tokens from the shop row but keeps the audit trail.
 */

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const hmac = req.headers.get("X-Shopify-Hmac-SHA256");
  if (!verifyWebhookHmac(rawBody, hmac, shopifyEnv.apiSecret())) {
    return new NextResponse("invalid hmac", { status: 401 });
  }

  const topic = req.headers.get("X-Shopify-Topic") ?? "";
  const shopDomain = req.headers.get("X-Shopify-Shop-Domain")?.trim().toLowerCase() ?? null;

  if (topic === "shop/redact" && shopDomain) {
    try {
      await prisma.shopifyShop.updateMany({
        where: { shopDomain },
        data: { accessToken: "", advertiserApiKey: null, advertiserApiKeyValid: false, advertiserAgentId: null },
      });
    } catch (err) {
      logger.error({ err, shopDomain, action: "shopify_gdpr_shop_redact" }, "shop redact failed");
    }
  }

  logger.info({ topic, shopDomain, action: "shopify_gdpr" }, "gdpr webhook acknowledged");
  return NextResponse.json({ ok: true });
}
