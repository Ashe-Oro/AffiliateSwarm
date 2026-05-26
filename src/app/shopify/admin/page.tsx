import Script from "next/script";
import { shopifyEnv } from "@/lib/shopify/env";
import { ShopifyAdminClient } from "./client";

/**
 * Embedded admin page rendered inside the Shopify admin iframe.
 *
 * Server render only produces a shell that loads App Bridge. All shop-
 * scoped data is fetched client-side via JWT-protected API routes (see
 * `./api/*`) — we never trust the `?shop=` query param for sensitive reads.
 *
 * CSP `frame-ancestors` is set in `next.config.ts` so this path can load
 * inside `*.myshopify.com` and `admin.shopify.com`.
 */

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ shop?: string; host?: string }>;
}

export default async function ShopifyAdminPage({ searchParams }: PageProps) {
  const { shop } = await searchParams;
  let apiKey = "";
  try {
    apiKey = shopifyEnv.apiKey();
  } catch {
    return (
      <main className="p-8 max-w-xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">AffiliateSwarm for Shopify</h1>
        <p className="text-sm text-muted-foreground">
          This deployment is missing <code>SHOPIFY_API_KEY</code>. Set the
          Shopify env vars on the server, then reinstall.
        </p>
      </main>
    );
  }

  return (
    <>
      {/* App Bridge auto-initialises from the meta tag and auto-injects
          Authorization: Bearer <session-token> on same-origin fetches. */}
      <meta name="shopify-api-key" content={apiKey} />
      <Script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" strategy="beforeInteractive" />
      <ShopifyAdminClient hintedShop={shop ?? null} />
    </>
  );
}
