import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { shopifyEnv } from "@/lib/shopify/env";

/**
 * Shopify OAuth helpers.
 *
 * Flow:
 *   /shopify/auth/install?shop=acme.myshopify.com
 *     → set state cookie, redirect to authorizeUrl()
 *   Shopify → /shopify/auth/callback?code=...&shop=...&state=...&hmac=...
 *     → verify state cookie + install HMAC, exchangeCodeForToken(), store shop
 */

const VALID_SHOP_DOMAIN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

export function isValidShopDomain(shop: string): boolean {
  return VALID_SHOP_DOMAIN.test(shop);
}

export function authorizeUrl(params: { shop: string; state: string }): string {
  const u = new URL(`https://${params.shop}/admin/oauth/authorize`);
  u.searchParams.set("client_id", shopifyEnv.apiKey());
  u.searchParams.set("scope", shopifyEnv.scopes().join(","));
  u.searchParams.set("redirect_uri", `${shopifyEnv.appUrl()}/shopify/auth/callback`);
  u.searchParams.set("state", params.state);
  return u.toString();
}

/**
 * State nonce is a random value + HMAC suffix so the callback can verify
 * the value originated from us without consulting any server-side store.
 */
export function generateState(): string {
  const nonce = randomBytes(16).toString("hex");
  const sig = createHmac("sha256", shopifyEnv.apiSecret()).update(nonce).digest("hex").slice(0, 32);
  return `${nonce}.${sig}`;
}

export function verifyState(state: string): boolean {
  const parts = state.split(".");
  if (parts.length !== 2) return false;
  const [nonce, sig] = parts;
  const expected = createHmac("sha256", shopifyEnv.apiSecret()).update(nonce).digest("hex").slice(0, 32);
  if (expected.length !== sig.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"));
  } catch {
    return false;
  }
}

export async function exchangeCodeForToken(params: {
  shop: string;
  code: string;
}): Promise<{ accessToken: string; scope: string }> {
  const res = await fetch(`https://${params.shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: shopifyEnv.apiKey(),
      client_secret: shopifyEnv.apiSecret(),
      code: params.code,
    }),
  });

  if (!res.ok) {
    throw new Error(`Shopify token exchange failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as { access_token: string; scope: string };
  return { accessToken: body.access_token, scope: body.scope };
}

/**
 * Register the webhooks we care about with the shop. Idempotent — Shopify
 * returns 422 if the topic+address pair already exists, which we treat as success.
 */
export async function registerWebhooks(params: {
  shop: string;
  accessToken: string;
}): Promise<void> {
  const topics = ["orders/paid", "app/uninstalled", "customers/data_request", "customers/redact", "shop/redact"] as const;
  const apiVersion = shopifyEnv.apiVersion();
  const appUrl = shopifyEnv.appUrl();

  for (const topic of topics) {
    const address = `${appUrl}/shopify/webhooks/${topic.replace("/", "-")}`;
    const res = await fetch(`https://${params.shop}/admin/api/${apiVersion}/webhooks.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": params.accessToken,
      },
      body: JSON.stringify({ webhook: { topic, address, format: "json" } }),
    });

    if (!res.ok && res.status !== 422) {
      throw new Error(`Failed to register ${topic}: ${res.status} ${await res.text()}`);
    }
  }
}
