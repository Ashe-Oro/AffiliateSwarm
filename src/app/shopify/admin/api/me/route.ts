import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  ensureShopInstalled,
  findShopByDomain,
} from "@/services/shopify-app";
import { requireSessionToken } from "@/services/shopify-app/admin-api-auth";

/**
 * GET /shopify/admin/api/me
 *
 * Authenticated via App Bridge session token. Lazily provisions the shop
 * row on first call via token exchange. Returns connection status + last
 * 10 attributed orders for display in the embedded admin.
 */

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireSessionToken(req);
  if (auth instanceof NextResponse) return auth;
  const { shopDomain, claims } = auth;

  try {
    await ensureShopInstalled({
      shopDomain,
      sessionToken: claims.iss ? req.headers.get("authorization")!.slice(7) : "",
    });
  } catch (err) {
    logger.error({ err, shopDomain, action: "shopify_admin_me_ensure_install" }, "ensureShopInstalled failed");
    // Continue — we may still have a usable row from a prior visit.
  }

  const shop = await findShopByDomain(shopDomain);
  if (!shop) {
    return NextResponse.json({ ok: false, error: "shop not found" }, { status: 404 });
  }

  const recentOrders = await prisma.shopifyAttributedOrder.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      shopifyOrderId: true,
      attributionPath: true,
      postbackStatus: true,
      postbackError: true,
      revenueCents: true,
      swarmRef: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    shop: shop.shopDomain,
    installedAt: shop.installedAt.toISOString(),
    apiKeyConfigured: !!shop.advertiserApiKey,
    apiKeyValid: shop.advertiserApiKeyValid,
    recentOrders: recentOrders.map((o) => ({
      ...o,
      createdAt: o.createdAt.toISOString(),
    })),
  });
}
