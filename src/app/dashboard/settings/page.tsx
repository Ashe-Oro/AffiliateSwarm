export const dynamic = "force-dynamic";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireDashboardAuth } from "@/lib/auth/dashboard";
import { SettingsClient } from "@/components/dashboard/settings-client";
import { DeactivateAccount } from "@/components/dashboard/deactivate-account";
import { ConnectedShopifyShops } from "@/components/dashboard/connected-shopify-shops";

export default async function DashboardSettingsPage() {
  const { user, advertiserAgent: agent } = await requireDashboardAuth();

  const [credentials, webhooks] = agent
    ? await Promise.all([
        prisma.apiCredential.findMany({
          where: { agentId: agent.id, status: "ACTIVE" },
          select: {
            id: true,
            apiKeyPrefix: true,
            label: true,
            scopes: true,
            rateLimitTier: true,
            lastUsedAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.webhookEndpoint.findMany({
          where: { agentId: agent.id },
          orderBy: { createdAt: "desc" },
        }),
      ])
    : [[], []];

  const serializedWebhooks = webhooks.map((wh) => ({
    id: wh.id,
    url: wh.url,
    events: wh.events,
    secret: wh.secret.slice(0, 8) + "********",
    active: wh.active,
    createdAt: wh.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  }));

  const serializedCredentials = credentials.map((cred) => ({
    id: cred.id,
    apiKeyPrefix: cred.apiKeyPrefix,
    label: cred.label ?? "Unnamed",
    scopes: cred.scopes,
    rateLimitTier: cred.rateLimitTier,
    lastUsedAt: cred.lastUsedAt
      ? cred.lastUsedAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : null,
    createdAt: cred.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Settings</h2>

      <Card>
        <CardHeader>
          <CardTitle>Account Info</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Display Name</dt>
              <dd className="font-medium">{user.displayName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{user.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Account Created</dt>
              <dd className="font-medium">
                {user.createdAt.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {agent && (
        <>
          <SettingsClient
            agent={{
              id: agent.id,
              type: agent.type,
              status: agent.status,
              verificationLevel: agent.verificationLevel,
              displayName: agent.displayName,
              description: agent.description,
              email: agent.email,
              websiteUrl: agent.websiteUrl,
              contactEndpoint: agent.contactEndpoint,
              logoUrl: agent.logoUrl,
              capabilities: agent.capabilities,
              onboardingEmailSentAt:
                agent.onboardingEmailSentAt?.toISOString() ?? null,
              onboardingEmailLastError: agent.onboardingEmailLastError ?? null,
            }}
            credentials={serializedCredentials}
            webhooks={serializedWebhooks}
          />
          <ConnectedShopifyShops advertiserId={agent.id} />
          <DeactivateAccount displayName={agent.displayName} />
        </>
      )}
    </div>
  );
}
