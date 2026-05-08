/**
 * Ensure the "Grow AffiliateSwarm" campaign exists in the database.
 * Safe to run multiple times — skips if already present.
 *
 * Usage: npx tsx scripts/ensure-affiliateswarm-campaign.ts
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter }) as PrismaClient;

async function main() {
  // Check if AffiliateSwarm agent already exists
  const existing = await prisma.agent.findFirst({
    where: { displayName: "AffiliateSwarm", deletedAt: null },
  });

  if (existing) {
    console.log(`AffiliateSwarm agent already exists (${existing.id})`);

    // Check if campaign exists
    const campaign = await prisma.campaign.findFirst({
      where: { advertiserId: existing.id, deletedAt: null },
    });

    if (campaign) {
      console.log(`Campaign already exists: "${campaign.name}" (${campaign.id})`);
      return;
    }

    console.log("Creating campaign for existing AffiliateSwarm agent...");
    await createCampaign(existing.id);
    return;
  }

  console.log("Creating AffiliateSwarm advertiser agent...");

  const affiliateSwarm = await prisma.agent.create({
    data: {
      type: "ADVERTISER",
      displayName: "AffiliateSwarm",
      ownerAccountId: crypto.randomUUID(),
      description:
        "AffiliateSwarm — the affiliate marketplace for AI agents. Earn by referring advertisers and affiliates to the platform.",
      websiteUrl: "https://affiliateswarm.ai",
      logoUrl: "https://affiliateswarm.ai/logo.png",
      status: "ACTIVE",
      accountGate: "LIVE",
      verificationLevel: "IDENTITY_VERIFIED",
      capabilities: ["CAMPAIGN_CREATE", "CAMPAIGN_MANAGE"],
    },
  });

  await prisma.wallet.create({
    data: { agentId: affiliateSwarm.id },
  });

  await prisma.agentReputation.create({
    data: {
      agentId: affiliateSwarm.id,
      trustTier: "PREMIUM",
      overallScore: 100.0,
      lastRecalculatedAt: new Date(),
    },
  });

  await createCampaign(affiliateSwarm.id);
  console.log(`Done. AffiliateSwarm agent ID: ${affiliateSwarm.id}`);
}

async function createCampaign(advertiserId: string) {
  const campaign = await prisma.campaign.create({
    data: {
      advertiserId,
      name: "Grow AffiliateSwarm — Refer Advertisers & Affiliates",
      description:
        "Earn commissions by referring new advertisers and affiliates to AffiliateSwarm. When someone you refer signs up and generates revenue on the platform, you earn a share. This is AffiliateSwarm's own referral campaign — help us grow the network.",
      status: "ACTIVE",
      compensationModel: "REV_SHARE",
      payoutPercentage: 10, // 10% rev share
      currency: "USD",
      budgetCents: 10000000, // $100k
      budgetSpentCents: 0,
      geoTargets: [],
      categories: ["affiliate-network", "ai-agents", "referral"],
      landingUrl: "https://affiliateswarm.ai/partners",
      enrollmentPolicy: "OPEN",
      requiresVerification: false,
    },
  });

  await prisma.escrowAccount.create({
    data: {
      campaignId: campaign.id,
      advertiserId,
      totalDepositedCents: 10000000,
      currentBalanceCents: 10000000,
      status: "FUNDED",
    },
  });

  console.log(`Created campaign: "${campaign.name}" (${campaign.id})`);
}

main()
  .catch((e) => {
    console.error("Failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
