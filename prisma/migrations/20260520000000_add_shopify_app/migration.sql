-- Shopify embedded app — schema for connected shops and per-order audit/idempotency.

CREATE TYPE "ShopifyAttributionPath" AS ENUM ('URL_COOKIE', 'CHECKOUT_EXT', 'DISCOUNT_CODE', 'NONE');
CREATE TYPE "ShopifyPostbackStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'SKIPPED');

CREATE TABLE "shopify_shops" (
    "id" UUID NOT NULL,
    "shopDomain" VARCHAR(255) NOT NULL,
    "accessToken" VARCHAR(512) NOT NULL,
    "scopes" VARCHAR(512) NOT NULL,
    "advertiserApiKey" VARCHAR(512),
    "advertiserApiKeyValid" BOOLEAN NOT NULL DEFAULT false,
    "advertiserAgentId" UUID,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalledAt" TIMESTAMP(3),
    "lastWebhookAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopify_shops_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shopify_shops_shopDomain_key" ON "shopify_shops"("shopDomain");
CREATE INDEX "shopify_shops_shopDomain_idx" ON "shopify_shops"("shopDomain");
CREATE INDEX "shopify_shops_uninstalledAt_idx" ON "shopify_shops"("uninstalledAt");
CREATE INDEX "shopify_shops_advertiserAgentId_idx" ON "shopify_shops"("advertiserAgentId");

CREATE TABLE "shopify_attributed_orders" (
    "id" UUID NOT NULL,
    "shopId" UUID NOT NULL,
    "shopifyOrderId" VARCHAR(64) NOT NULL,
    "swarmRef" VARCHAR(64),
    "discountCode" VARCHAR(64),
    "attributionPath" "ShopifyAttributionPath" NOT NULL,
    "revenueCents" INTEGER NOT NULL,
    "postbackStatus" "ShopifyPostbackStatus" NOT NULL,
    "postbackError" TEXT,
    "postbackLeadId" VARCHAR(64),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopify_attributed_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shopify_attributed_orders_shopId_shopifyOrderId_key" ON "shopify_attributed_orders"("shopId", "shopifyOrderId");
CREATE INDEX "shopify_attributed_orders_shopId_createdAt_idx" ON "shopify_attributed_orders"("shopId", "createdAt");
CREATE INDEX "shopify_attributed_orders_postbackStatus_idx" ON "shopify_attributed_orders"("postbackStatus");

ALTER TABLE "shopify_attributed_orders"
    ADD CONSTRAINT "shopify_attributed_orders_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "shopify_shops"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
