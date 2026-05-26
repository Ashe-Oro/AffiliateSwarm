import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { shopifyEnv } from "@/lib/shopify/env";
import { processOrderPaid, verifyWebhookHmac } from "@/services/shopify-app";

/**
 * POST /shopify/webhooks/orders-paid
 *
 * Fires for every order Shopify confirms as paid. We:
 *   1. HMAC-verify the raw body (401 if mismatch).
 *   2. Hand off to processOrderPaid which is idempotent on (shopId, orderId).
 *   3. Return 200 for success/permanent failures, 500 for transient failures
 *      so Shopify retries (~19x over 48h).
 */

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const hmacHeader = req.headers.get("X-Shopify-Hmac-SHA256");
  const shopDomain = req.headers.get("X-Shopify-Shop-Domain")?.trim().toLowerCase();

  if (!verifyWebhookHmac(rawBody, hmacHeader, shopifyEnv.apiSecret())) {
    return new NextResponse("invalid hmac", { status: 401 });
  }
  if (!shopDomain) {
    return new NextResponse("missing shop header", { status: 400 });
  }

  let order;
  try {
    order = JSON.parse(rawBody) as { id: number | string };
  } catch {
    return new NextResponse("invalid json", { status: 400 });
  }

  try {
    const result = await processOrderPaid({ shopDomain, order });
    if (result.outcome === "transient_failure") {
      return new NextResponse(JSON.stringify(result), { status: 500 });
    }
    return NextResponse.json(result);
  } catch (err) {
    logger.error({ err, shopDomain, action: "shopify_orders_paid" }, "order processing crashed");
    return new NextResponse("internal error", { status: 500 });
  }
}
