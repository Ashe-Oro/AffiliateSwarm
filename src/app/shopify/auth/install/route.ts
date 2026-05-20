import { NextRequest, NextResponse } from "next/server";
import { authorizeUrl, generateState, isValidShopDomain } from "@/services/shopify-app";

/**
 * GET /shopify/auth/install?shop=<shop>.myshopify.com
 *
 * Entry point for OAuth. Validates the shop domain, mints a state nonce
 * (stored in a short-lived signed cookie), and redirects the merchant to
 * Shopify's authorize URL.
 */

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get("shop")?.trim().toLowerCase() ?? "";

  if (!isValidShopDomain(shop)) {
    return NextResponse.json(
      { error: "Invalid shop parameter. Expected <name>.myshopify.com." },
      { status: 400 },
    );
  }

  const state = generateState();
  const url = authorizeUrl({ shop, state });

  const res = NextResponse.redirect(url);
  res.cookies.set("shopify_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/shopify/auth",
    maxAge: 10 * 60,
  });
  return res;
}
