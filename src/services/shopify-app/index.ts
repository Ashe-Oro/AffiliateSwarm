import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  resolveAttribution,
  extractRevenueCents,
  type ShopifyOrderPayload,
} from "./attribution";
import { sendPostback } from "./postback";
import { findShopByDomain, touchWebhookReceived } from "./shop-store";

export * from "./hmac";
export * from "./oauth";
export * from "./shop-store";
export * from "./attribution";
export * from "./postback";

export type ProcessOrderResult =
  | { outcome: "skipped"; reason: "no_shop" | "no_api_key" | "no_attribution" | "duplicate" }
  | { outcome: "success"; leadId: string | null }
  | { outcome: "permanent_failure"; error: string }
  | { outcome: "transient_failure"; error: string };

/**
 * Process an `orders/paid` webhook end-to-end. Idempotent on
 * `(shopId, shopifyOrderId)` — repeated invocations return the recorded result.
 *
 * Returns a result the webhook handler uses to decide whether to ack (200)
 * or ask Shopify to retry (500).
 */
export async function processOrderPaid(params: {
  shopDomain: string;
  order: ShopifyOrderPayload;
}): Promise<ProcessOrderResult> {
  const log = logger.child({ component: "shopify-app", shopDomain: params.shopDomain, shopifyOrderId: String(params.order.id) });

  const shop = await findShopByDomain(params.shopDomain);
  if (!shop || shop.uninstalledAt) {
    log.warn("webhook for unknown or uninstalled shop");
    return { outcome: "skipped", reason: "no_shop" };
  }

  touchWebhookReceived(params.shopDomain).catch((err) => log.warn({ err }, "touchWebhookReceived failed"));

  const shopifyOrderId = String(params.order.id);
  const revenueCents = extractRevenueCents(params.order);

  if (!shop.advertiserApiKey) {
    await recordAttempt({
      shopId: shop.id,
      shopifyOrderId,
      revenueCents,
      attribution: { path: "NONE" },
      status: "SKIPPED",
      error: "no_api_key",
    });
    return { outcome: "skipped", reason: "no_api_key" };
  }

  const attribution = await resolveAttribution({
    order: params.order,
    advertiserApiKey: shop.advertiserApiKey,
  });

  if (attribution.path === "NONE") {
    await recordAttempt({
      shopId: shop.id,
      shopifyOrderId,
      revenueCents,
      attribution,
      status: "SKIPPED",
      error: "no_attribution",
    });
    return { outcome: "skipped", reason: "no_attribution" };
  }

  // Idempotency: reserve the row first so a duplicate webhook short-circuits.
  const reserved = await reserveAttemptRow({
    shopId: shop.id,
    shopifyOrderId,
    revenueCents,
    attribution,
  });

  if (reserved.alreadyExisted) {
    log.info({ status: reserved.row.postbackStatus }, "duplicate webhook — short-circuiting");
    return { outcome: "skipped", reason: "duplicate" };
  }

  const swarmRef =
    attribution.path === "DISCOUNT_CODE"
      ? attribution.swarmRef
      : attribution.swarmRef;
  const discountCode = attribution.path === "DISCOUNT_CODE" ? attribution.discountCode : undefined;

  const result = await sendPostback(shop.advertiserApiKey, {
    swarm_ref: swarmRef,
    externalId: `shopify_${shop.id}_${shopifyOrderId}`,
    eventType: "PURCHASE",
    revenueCents,
    metadata: {
      orderId: shopifyOrderId,
      shopDomain: shop.shopDomain,
      ...(discountCode ? { discountCode } : {}),
    },
  });

  await prisma.shopifyAttributedOrder.update({
    where: { shopId_shopifyOrderId: { shopId: shop.id, shopifyOrderId } },
    data: {
      attemptCount: result.attempts,
      postbackStatus: result.status === "success" ? "SUCCESS" : "FAILED",
      postbackError: result.status === "success" ? null : result.status === "permanent_failure" ? `HTTP ${result.httpStatus}: ${result.error}` : result.error,
      postbackLeadId: result.status === "success" ? result.leadId : null,
    },
  });

  if (result.status === "success") {
    log.info({ leadId: result.leadId, attempts: result.attempts }, "postback succeeded");
    return { outcome: "success", leadId: result.leadId };
  }

  if (result.status === "permanent_failure") {
    log.warn({ httpStatus: result.httpStatus, error: result.error }, "postback permanently failed");
    return { outcome: "permanent_failure", error: result.error };
  }

  log.warn({ error: result.error }, "postback transient failure — asking Shopify to retry");
  return { outcome: "transient_failure", error: result.error };
}

async function recordAttempt(params: {
  shopId: string;
  shopifyOrderId: string;
  revenueCents: number;
  attribution: { path: "NONE" } | { path: "URL_COOKIE" | "CHECKOUT_EXT"; swarmRef: string } | { path: "DISCOUNT_CODE"; swarmRef: string; discountCode: string };
  status: "SKIPPED" | "FAILED";
  error: string;
}): Promise<void> {
  await prisma.shopifyAttributedOrder.upsert({
    where: {
      shopId_shopifyOrderId: {
        shopId: params.shopId,
        shopifyOrderId: params.shopifyOrderId,
      },
    },
    create: {
      shopId: params.shopId,
      shopifyOrderId: params.shopifyOrderId,
      swarmRef: params.attribution.path === "NONE" ? null : params.attribution.swarmRef,
      discountCode: params.attribution.path === "DISCOUNT_CODE" ? params.attribution.discountCode : null,
      attributionPath: params.attribution.path,
      revenueCents: params.revenueCents,
      postbackStatus: params.status,
      postbackError: params.error,
    },
    update: {
      postbackStatus: params.status,
      postbackError: params.error,
    },
  });
}

async function reserveAttemptRow(params: {
  shopId: string;
  shopifyOrderId: string;
  revenueCents: number;
  attribution: Exclude<Awaited<ReturnType<typeof resolveAttribution>>, { path: "NONE" }>;
}): Promise<{ alreadyExisted: boolean; row: { postbackStatus: string } }> {
  const existing = await prisma.shopifyAttributedOrder.findUnique({
    where: { shopId_shopifyOrderId: { shopId: params.shopId, shopifyOrderId: params.shopifyOrderId } },
    select: { postbackStatus: true },
  });
  if (existing) {
    return { alreadyExisted: true, row: existing };
  }
  const row = await prisma.shopifyAttributedOrder.create({
    data: {
      shopId: params.shopId,
      shopifyOrderId: params.shopifyOrderId,
      swarmRef: params.attribution.swarmRef,
      discountCode: params.attribution.path === "DISCOUNT_CODE" ? params.attribution.discountCode : null,
      attributionPath: params.attribution.path,
      revenueCents: params.revenueCents,
      postbackStatus: "PENDING",
    },
    select: { postbackStatus: true },
  });
  return { alreadyExisted: false, row };
}
