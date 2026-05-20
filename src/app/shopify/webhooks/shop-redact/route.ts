import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { shopifyEnv } from "@/lib/shopify/env";
import { verifyWebhookHmac } from "@/services/shopify-app";

/**
 * GDPR — shop/redact
 *
 * Fires 48h after a shop uninstalls the app. We drop the encrypted access
 * token and pasted API key but keep the audit history (no PII).
 */

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const hmac = req.headers.get("X-Shopify-Hmac-SHA256");
  if (!verifyWebhookHmac(rawBody, hmac, shopifyEnv.apiSecret())) {
    return new NextResponse("invalid hmac", { status: 401 });
  }

  const shopDomain = req.headers.get("X-Shopify-Shop-Domain")?.trim().toLowerCase();
  if (shopDomain) {
    try {
      await prisma.shopifyShop.updateMany({
        where: { shopDomain },
        data: { accessToken: "", advertiserApiKey: null, advertiserApiKeyValid: false },
      });
    } catch (err) {
      logger.error({ err, shopDomain, action: "shopify_gdpr_shop_redact" }, "shop redact failed");
    }
  }

  return NextResponse.json({ ok: true });
}
