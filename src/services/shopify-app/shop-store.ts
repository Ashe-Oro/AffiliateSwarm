import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/shopify/crypto";
import type { ShopifyShop } from "@/generated/prisma/client";

/**
 * CRUD over `ShopifyShop` with transparent encryption of `accessToken`
 * and `advertiserApiKey`. Callers never see the encrypted blobs.
 */

export interface DecryptedShop {
  id: string;
  shopDomain: string;
  accessToken: string;
  scopes: string;
  advertiserApiKey: string | null;
  advertiserApiKeyValid: boolean;
  advertiserAgentId: string | null;
  installedAt: Date;
  uninstalledAt: Date | null;
  lastWebhookAt: Date | null;
}

function decrypt(shop: ShopifyShop): DecryptedShop {
  return {
    id: shop.id,
    shopDomain: shop.shopDomain,
    accessToken: shop.accessToken ? decryptSecret(shop.accessToken) : "",
    scopes: shop.scopes,
    advertiserApiKey: shop.advertiserApiKey ? decryptSecret(shop.advertiserApiKey) : null,
    advertiserApiKeyValid: shop.advertiserApiKeyValid,
    advertiserAgentId: shop.advertiserAgentId,
    installedAt: shop.installedAt,
    uninstalledAt: shop.uninstalledAt,
    lastWebhookAt: shop.lastWebhookAt,
  };
}

export async function upsertShopOnInstall(params: {
  shopDomain: string;
  accessToken: string;
  scopes: string;
}): Promise<DecryptedShop> {
  const encryptedToken = encryptSecret(params.accessToken);
  const shop = await prisma.shopifyShop.upsert({
    where: { shopDomain: params.shopDomain },
    create: {
      shopDomain: params.shopDomain,
      accessToken: encryptedToken,
      scopes: params.scopes,
    },
    update: {
      accessToken: encryptedToken,
      scopes: params.scopes,
      uninstalledAt: null,
    },
  });
  return decrypt(shop);
}

export async function findShopByDomain(shopDomain: string): Promise<DecryptedShop | null> {
  const shop = await prisma.shopifyShop.findUnique({ where: { shopDomain } });
  return shop ? decrypt(shop) : null;
}

export async function setAdvertiserApiKey(
  shopDomain: string,
  apiKey: string,
  valid: boolean,
  advertiserAgentId: string | null = null,
): Promise<void> {
  await prisma.shopifyShop.update({
    where: { shopDomain },
    data: {
      advertiserApiKey: encryptSecret(apiKey),
      advertiserApiKeyValid: valid,
      advertiserAgentId,
    },
  });
}

export async function markShopUninstalled(shopDomain: string): Promise<void> {
  // Keep the row for the audit trail; clear the access token so a future
  // reinstall mints a new one and old leaked copies are useless.
  await prisma.shopifyShop.updateMany({
    where: { shopDomain },
    data: {
      uninstalledAt: new Date(),
      accessToken: encryptSecret(""),
    },
  });
}

export async function touchWebhookReceived(shopDomain: string): Promise<void> {
  await prisma.shopifyShop.updateMany({
    where: { shopDomain },
    data: { lastWebhookAt: new Date() },
  });
}
