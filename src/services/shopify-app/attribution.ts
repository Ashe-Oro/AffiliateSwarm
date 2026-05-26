import { logger } from "@/lib/logger";
import { shopifyEnv } from "@/lib/shopify/env";

/**
 * Attribution resolver for a Shopify order webhook payload.
 *
 * Tries each path in priority order:
 *   1. note_attributes['swarm_ref'] (set by Theme App Extension or Checkout UI Extension)
 *   2. matching discount code looked up against AffiliateSwarm
 *   3. NONE
 */

export type Attribution =
  | { path: "URL_COOKIE"; swarmRef: string }
  | { path: "CHECKOUT_EXT"; swarmRef: string }
  | { path: "DISCOUNT_CODE"; swarmRef: string; discountCode: string }
  | { path: "NONE" };

export interface ShopifyOrderPayload {
  id: number | string;
  current_subtotal_price?: string;
  subtotal_price?: string;
  total_price?: string;
  note_attributes?: { name: string; value: string }[];
  discount_codes?: { code: string }[];
}

export function extractRevenueCents(order: ShopifyOrderPayload): number {
  const raw = order.current_subtotal_price ?? order.subtotal_price ?? order.total_price ?? "0";
  const parsed = Number.parseFloat(raw);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

export async function resolveAttribution(params: {
  order: ShopifyOrderPayload;
  advertiserApiKey: string | null;
  lookupDiscount?: typeof lookupDiscountSwarmRef;
}): Promise<Attribution> {
  const noteAttrs = (params.order.note_attributes ?? []).reduce<Record<string, string>>(
    (acc, a) => ({ ...acc, [a.name]: a.value }),
    {},
  );

  const swarmRef = noteAttrs["swarm_ref"]?.trim();
  if (swarmRef && /^[A-Za-z0-9_-]{6,32}$/.test(swarmRef)) {
    const source = noteAttrs["swarm_source"];
    return source === "checkout_ext"
      ? { path: "CHECKOUT_EXT", swarmRef }
      : { path: "URL_COOKIE", swarmRef };
  }

  if (!params.advertiserApiKey) return { path: "NONE" };

  const lookup = params.lookupDiscount ?? lookupDiscountSwarmRef;
  for (const dc of params.order.discount_codes ?? []) {
    const code = dc.code?.trim();
    if (!code) continue;
    try {
      const ref = await lookup({ code, advertiserApiKey: params.advertiserApiKey });
      if (ref) {
        return { path: "DISCOUNT_CODE", swarmRef: ref, discountCode: code };
      }
    } catch (err) {
      logger.warn({ err, code, action: "shopify_discount_lookup" }, "discount lookup failed");
    }
  }

  return { path: "NONE" };
}

const discountCache = new Map<string, { swarmRef: string | null; expiresAt: number }>();
const DISCOUNT_TTL_MS = 5 * 60 * 1000;

export async function lookupDiscountSwarmRef(params: {
  code: string;
  advertiserApiKey: string;
}): Promise<string | null> {
  const cacheKey = `${params.advertiserApiKey.slice(0, 16)}:${params.code}`;
  const cached = discountCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.swarmRef;
  }

  const url = `${shopifyEnv.affiliateswarmApiBase()}/api/v1/advertiser/discount-lookup?code=${encodeURIComponent(params.code)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${params.advertiserApiKey}` },
  });

  if (res.status === 404) {
    discountCache.set(cacheKey, { swarmRef: null, expiresAt: Date.now() + DISCOUNT_TTL_MS });
    return null;
  }

  if (!res.ok) {
    throw new Error(`discount-lookup returned ${res.status}`);
  }

  const body = (await res.json()) as { success: boolean; data?: { swarmRef: string } };
  const swarmRef = body.data?.swarmRef ?? null;
  discountCache.set(cacheKey, { swarmRef, expiresAt: Date.now() + DISCOUNT_TTL_MS });
  return swarmRef;
}

/** Test-only cache reset. */
export function _resetDiscountCache(): void {
  discountCache.clear();
}
