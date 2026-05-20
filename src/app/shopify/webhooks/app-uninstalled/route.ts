import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { shopifyEnv } from "@/lib/shopify/env";
import { markShopUninstalled, verifyWebhookHmac } from "@/services/shopify-app";

/**
 * POST /shopify/webhooks/app-uninstalled
 *
 * Shopify fires this when the merchant removes the app. We clear the
 * access token (so any leaked copies are useless) and timestamp the row,
 * but keep ShopifyAttributedOrder history for the merchant's audit trail.
 */

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const hmac = req.headers.get("X-Shopify-Hmac-SHA256");
  const shopDomain = req.headers.get("X-Shopify-Shop-Domain")?.trim().toLowerCase();

  if (!verifyWebhookHmac(rawBody, hmac, shopifyEnv.apiSecret())) {
    return new NextResponse("invalid hmac", { status: 401 });
  }
  if (!shopDomain) {
    return new NextResponse("missing shop header", { status: 400 });
  }

  try {
    await markShopUninstalled(shopDomain);
    logger.info({ shopDomain, action: "shopify_app_uninstalled" }, "shop uninstalled");
  } catch (err) {
    logger.error({ err, shopDomain, action: "shopify_app_uninstalled" }, "failed to mark uninstall");
  }

  return NextResponse.json({ ok: true });
}
