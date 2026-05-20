import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { shopifyEnv } from "@/lib/shopify/env";
import {
  exchangeCodeForToken,
  isValidShopDomain,
  registerWebhooks,
  upsertShopOnInstall,
  verifyInstallHmac,
  verifyState,
} from "@/services/shopify-app";

/**
 * GET /shopify/auth/callback
 *
 * Shopify redirects here with ?code=...&shop=...&state=...&hmac=...&timestamp=...
 * after the merchant approves the install. We:
 *   1. Verify the state cookie matches the `state` query (anti-CSRF).
 *   2. Verify Shopify's HMAC over the query string (proves Shopify sent us).
 *   3. Exchange the code for a permanent access token.
 *   4. Upsert ShopifyShop with the encrypted token.
 *   5. Register the webhooks we care about.
 *   6. Redirect to the embedded admin page.
 */

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const shop = params.get("shop")?.trim().toLowerCase() ?? "";
  const code = params.get("code");
  const state = params.get("state");

  if (!isValidShopDomain(shop) || !code || !state) {
    return NextResponse.json({ error: "Invalid callback parameters" }, { status: 400 });
  }

  const cookieState = req.cookies.get("shopify_oauth_state")?.value;
  if (!cookieState || cookieState !== state || !verifyState(state)) {
    logger.warn({ shop, action: "shopify_oauth_state" }, "state mismatch");
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }

  const queryObj: Record<string, string | null> = {};
  for (const [k, v] of params.entries()) queryObj[k] = v;

  if (!verifyInstallHmac(queryObj, shopifyEnv.apiSecret())) {
    logger.warn({ shop, action: "shopify_install_hmac" }, "install HMAC verification failed");
    return NextResponse.json({ error: "Invalid HMAC" }, { status: 400 });
  }

  try {
    const { accessToken, scope } = await exchangeCodeForToken({ shop, code });
    await upsertShopOnInstall({ shopDomain: shop, accessToken, scopes: scope });

    registerWebhooks({ shop, accessToken }).catch((err) =>
      logger.error({ err, shop, action: "shopify_register_webhooks" }, "failed to register webhooks"),
    );
  } catch (err) {
    logger.error({ err, shop, action: "shopify_token_exchange" }, "OAuth completion failed");
    return NextResponse.json({ error: "OAuth completion failed" }, { status: 500 });
  }

  const adminUrl = new URL(`${shopifyEnv.appUrl()}/shopify/admin`);
  adminUrl.searchParams.set("shop", shop);

  const res = NextResponse.redirect(adminUrl.toString());
  res.cookies.delete("shopify_oauth_state");
  return res;
}
