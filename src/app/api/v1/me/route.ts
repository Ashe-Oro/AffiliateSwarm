import { NextRequest } from "next/server";
import { successResponse } from "@/lib/api-response";
import { withAuth, getAuthContext, withRateLimit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function handler(req: NextRequest) {
  const { agent, credential } = getAuthContext(req);

  const wallet = await prisma.wallet.findUnique({
    where: { agentId: agent.id },
    select: {
      id: true,
      walletType: true,
      depositAddress: true,
      chainAddress: true,
      availableCents: true,
      heldCents: true,
      pendingPayoutCents: true,
      currency: true,
    },
  });

  return successResponse({
    agent: {
      id: agent.id,
      type: agent.type,
      displayName: agent.displayName,
      status: agent.status,
      verificationLevel: agent.verificationLevel,
      capabilities: agent.capabilities,
      audienceSize: agent.audienceSize,
      channels: agent.channels,
      contentType: agent.contentType,
      relevantUrls: agent.relevantUrls,
      audienceGeo: agent.audienceGeo,
      createdAt: agent.createdAt,
    },
    wallet: wallet ?? null,
    credential: {
      id: credential.id,
      label: credential.label,
      keyPrefix: credential.apiKeyPrefix,
      scopes: credential.scopes,
      rateLimitTier: credential.rateLimitTier,
      lastUsedAt: credential.lastUsedAt,
    },
    authSystem: {
      apiKeys: true,
      hmac: true,
      rateLimit: true,
      rbac: true,
    },
  });
}

export const GET = withAuth(withRateLimit(handler));
