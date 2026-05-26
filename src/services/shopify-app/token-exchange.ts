import { logger } from "@/lib/logger";
import { shopifyEnv } from "@/lib/shopify/env";
import { findShopByDomain, upsertShopOnInstall } from "./shop-store";

/**
 * Shopify token exchange — replaces the legacy OAuth authorization-code grant
 * for embedded apps. Takes a session-token JWT from App Bridge and returns
 * an Admin API access token for that shop.
 *
 * Docs: https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/token-exchange
 */

const GRANT_TYPE = "urn:ietf:params:oauth:grant-type:token-exchange";
const SUBJECT_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:id_token";
const OFFLINE_TOKEN_TYPE = "urn:shopify:params:oauth:token-type:offline-access-token";

export interface AccessTokenResponse {
  accessToken: string;
  scope: string;
}

/**
 * Exchange a session token for an offline access token. The offline variant
 * persists across the user's session — appropriate for backend webhook
 * forwarding where we need to act outside the user's admin visit.
 */
export async function exchangeSessionTokenForAccess(
  shopDomain: string,
  sessionToken: string,
): Promise<AccessTokenResponse> {
  const res = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: shopifyEnv.apiKey(),
      client_secret: shopifyEnv.apiSecret(),
      grant_type: GRANT_TYPE,
      subject_token: sessionToken,
      subject_token_type: SUBJECT_TOKEN_TYPE,
      requested_token_type: OFFLINE_TOKEN_TYPE,
    }),
  });

  if (!res.ok) {
    throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as { access_token: string; scope: string };
  return { accessToken: body.access_token, scope: body.scope };
}

/**
 * Ensure we have a ShopifyShop row for this shop, exchanging a token to mint
 * an access token on first contact. Idempotent — repeat calls return the
 * cached shop without re-exchanging unless `forceRefresh` is set.
 */
export async function ensureShopInstalled(params: {
  shopDomain: string;
  sessionToken: string;
  forceRefresh?: boolean;
}): Promise<void> {
  const existing = await findShopByDomain(params.shopDomain);
  if (existing && !params.forceRefresh && !existing.uninstalledAt && existing.accessToken) {
    return;
  }

  try {
    const { accessToken, scope } = await exchangeSessionTokenForAccess(
      params.shopDomain,
      params.sessionToken,
    );
    await upsertShopOnInstall({
      shopDomain: params.shopDomain,
      accessToken,
      scopes: scope,
    });
  } catch (err) {
    logger.error({ err, shopDomain: params.shopDomain, action: "shopify_token_exchange" }, "token exchange failed");
    throw err;
  }
}
