import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

interface Props {
  advertiserId: string;
}

/**
 * Settings card listing Shopify shops connected to this advertiser.
 * Read-only — merchants manage the connection from inside Shopify admin.
 */
export async function ConnectedShopifyShops({ advertiserId }: Props) {
  const shops = await prisma.shopifyShop.findMany({
    where: { advertiserAgentId: advertiserId, uninstalledAt: null },
    select: {
      id: true,
      shopDomain: true,
      installedAt: true,
      advertiserApiKeyValid: true,
      lastWebhookAt: true,
    },
    orderBy: { installedAt: "desc" },
  });

  if (shops.length === 0) {
    return null;
  }

  const counts = await prisma.shopifyAttributedOrder.groupBy({
    by: ["shopId"],
    where: { shopId: { in: shops.map((s) => s.id) } },
    _count: { _all: true },
  });
  const countByShop = new Map(counts.map((c) => [c.shopId, c._count._all]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected Shopify shops</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y text-sm">
          {shops.map((shop) => (
            <li key={shop.id} className="py-3 flex items-center justify-between">
              <div>
                <p className="font-medium">{shop.shopDomain}</p>
                <p className="text-muted-foreground text-xs">
                  Connected {shop.installedAt.toLocaleDateString()} ·{" "}
                  {shop.advertiserApiKeyValid ? "key validated" : "key not validated"}
                  {shop.lastWebhookAt && (
                    <> · last order {shop.lastWebhookAt.toLocaleString()}</>
                  )}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {countByShop.get(shop.id) ?? 0} attributed orders
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
