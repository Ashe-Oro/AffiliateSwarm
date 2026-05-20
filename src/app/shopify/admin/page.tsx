import { prisma } from "@/lib/prisma";
import { findShopByDomain, isValidShopDomain } from "@/services/shopify-app";
import { ShopifyAdminClient } from "./client";

/**
 * GET /shopify/admin?shop=<shop>.myshopify.com
 *
 * Embedded admin page. Loads inside the Shopify admin iframe — frame-ancestors
 * are allowed via headers below. If no shop is connected (direct visit
 * without the shop param), shows an install pointer.
 */

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ shop?: string }>;
}

export default async function ShopifyAdminPage({ searchParams }: PageProps) {
  const { shop } = await searchParams;
  const shopDomain = shop?.trim().toLowerCase() ?? "";

  if (!isValidShopDomain(shopDomain)) {
    return (
      <main className="p-8 max-w-xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">AffiliateSwarm for Shopify</h1>
        <p className="text-sm text-muted-foreground">
          This page must be opened from your Shopify admin. If you are a
          merchant trying to install the app, visit
          {" "}
          <code>/shopify/auth/install?shop=YOUR-STORE.myshopify.com</code>.
        </p>
      </main>
    );
  }

  const dbShop = await findShopByDomain(shopDomain);
  const connected = dbShop && !dbShop.uninstalledAt;

  const recentOrders = connected
    ? await prisma.shopifyAttributedOrder.findMany({
        where: { shopId: dbShop.id },
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
      })
    : [];

  return (
    <ShopifyAdminClient
      shop={shopDomain}
      connected={!!connected}
      apiKeyConfigured={!!dbShop?.advertiserApiKey}
      apiKeyValid={!!dbShop?.advertiserApiKeyValid}
      installedAt={dbShop?.installedAt?.toISOString() ?? null}
      recentOrders={recentOrders.map((o) => ({
        ...o,
        createdAt: o.createdAt.toISOString(),
      }))}
    />
  );
}
