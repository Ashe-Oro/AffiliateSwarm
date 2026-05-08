import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { withAuth, getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/v1/onboarding/status — Get onboarding checklist for the current agent.
 *
 * Returns a step-by-step checklist showing what's done and what's next.
 * Designed for AI agents to understand where they are in the setup process.
 */
export const GET = withAuth(async (req: NextRequest) => {
  const { agent } = getAuthContext(req);

  const [wallet, campaigns, enrollments, reputation] = await Promise.all([
    prisma.wallet.findUnique({ where: { agentId: agent.id } }),
    prisma.campaign.findMany({
      where: { advertiserId: agent.id, deletedAt: null },
      select: { id: true, status: true, name: true },
    }),
    prisma.affiliateEnrollment.findMany({
      where: { affiliateId: agent.id },
      select: { id: true, status: true },
    }),
    prisma.agentReputation.findUnique({
      where: { agentId: agent.id },
      select: { trustTier: true, overallScore: true },
    }),
  ]);

  const walletInitialized = !!(wallet?.walletType);
  const hasCampaigns = campaigns.length > 0;
  const hasActiveCampaign = campaigns.some((c) => c.status === "ACTIVE");
  const hasEnrollments = enrollments.length > 0;
  const hasApprovedEnrollment = enrollments.some((e) => e.status === "APPROVED");
  const emailVerified = agent.verificationLevel !== "UNVERIFIED";

  const isAdvertiser = agent.type === "ADVERTISER" || agent.type === "DUAL";
  const isAffiliate = agent.type === "AFFILIATE" || agent.type === "DUAL";

  const steps: Array<{
    step: string;
    status: "done" | "pending" | "not_applicable";
    description: string;
    action?: string;
  }> = [];

  // Common steps
  steps.push({
    step: "register",
    status: "done",
    description: "Registered on Regatta",
  });

  steps.push({
    step: "email_verified",
    status: emailVerified ? "done" : "pending",
    description: "Email address verified",
    ...(!emailVerified && {
      action: "Check your human's email for a verification link from Regatta",
    }),
  });

  steps.push({
    step: "wallet_initialized",
    status: walletInitialized ? "done" : "pending",
    description: "Wallet initialized for payments (auto-provisioned at registration)",
    ...(!walletInitialized && {
      action:
        "This should never be pending — wallets are initialized automatically during POST /api/v1/agents. If you see this, contact support.",
    }),
  });

  // Advertiser steps
  if (isAdvertiser) {
    steps.push({
      step: "campaign_created",
      status: hasCampaigns ? "done" : "pending",
      description: "Created at least one campaign",
      ...(!hasCampaigns && {
        action: "POST /api/v1/campaigns with your campaign details",
      }),
    });

    steps.push({
      step: "campaign_funded",
      status: agent.accountGate !== "PENDING" ? "done" : "pending",
      description: "Funded campaign escrow",
      ...( agent.accountGate === "PENDING" && {
        action: "POST /api/v1/wallets/:agentId/deposits/stripe with campaignId and amount",
      }),
    });

    steps.push({
      step: "campaign_activated",
      status: hasActiveCampaign ? "done" : "pending",
      description: "Activated campaign (visible to affiliates)",
      ...(!hasActiveCampaign && hasCampaigns && {
        action: "POST /api/v1/campaigns/:campaignId/activate",
      }),
    });

    steps.push({
      step: "postback_configured",
      status: agent.accountGate === "LIVE" ? "done" : "pending",
      description: "Server-to-server postback working",
      ...(agent.accountGate !== "LIVE" && {
        action: "Set up your backend to call POST /api/v1/postback when conversions happen",
      }),
    });
  }

  // Affiliate steps
  if (isAffiliate) {
    steps.push({
      step: "campaign_discovered",
      status: hasEnrollments ? "done" : "pending",
      description: "Applied to at least one campaign",
      ...(!hasEnrollments && {
        action: "GET /api/v1/discover/campaigns to find campaigns, then POST /api/v1/campaigns/:id/applications",
      }),
    });

    steps.push({
      step: "enrollment_approved",
      status: hasApprovedEnrollment ? "done" : "pending",
      description: "Approved for at least one campaign",
      ...(!hasApprovedEnrollment && hasEnrollments && {
        action: "Wait for the advertiser to approve your application",
      }),
    });
  }

  const completedSteps = steps.filter((s) => s.status === "done").length;
  const totalSteps = steps.filter((s) => s.status !== "not_applicable").length;
  const nextStep = steps.find((s) => s.status === "pending");

  return successResponse({
    agentId: agent.id,
    agentType: agent.type,
    accountGate: agent.accountGate,
    progress: `${completedSteps}/${totalSteps}`,
    complete: completedSteps === totalSteps,
    nextStep: nextStep
      ? { step: nextStep.step, description: nextStep.description, action: nextStep.action }
      : null,
    steps,
    reputation: reputation
      ? { trustTier: reputation.trustTier, score: reputation.overallScore }
      : null,
  });
});
