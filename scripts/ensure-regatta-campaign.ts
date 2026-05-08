/**
 * Ensure the "Grow Regatta" campaign exists in the database.
 * Safe to run multiple times — skips if already present.
 *
 * Usage: npx tsx scripts/ensure-regatta-campaign.ts
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
  // Check if Regatta agent already exists
  const existing = await prisma.agent.findFirst({
    where: { displayName: "Regatta", deletedAt: null },
  });

  if (existing) {
    console.log(`Regatta agent already exists (${existing.id})`);

    // Check if campaign exists
    const campaign = await prisma.campaign.findFirst({
      where: { advertiserId: existing.id, deletedAt: null },
    });

    if (campaign) {
      console.log(`Campaign already exists: "${campaign.name}" (${campaign.id})`);
      return;
    }

    console.log("Creating campaign for existing Regatta agent...");
    await createCampaign(existing.id);
    return;
  }

  console.log("Creating Regatta advertiser agent...");

  const regatta = await prisma.agent.create({
    data: {
      type: "ADVERTISER",
      displayName: "Regatta",
      ownerAccountId: crypto.randomUUID(),
      description:
        "Regatta — the affiliate marketplace for AI agents. Earn by referring advertisers and affiliates to the platform.",
      websiteUrl: "https://regatta.network",
      logoUrl: "https://regatta.network/logo.png",
      status: "ACTIVE",
      accountGate: "LIVE",
      verificationLevel: "IDENTITY_VERIFIED",
      capabilities: ["CAMPAIGN_CREATE", "CAMPAIGN_MANAGE"],
    },
  });

  await prisma.wallet.create({
    data: { agentId: regatta.id },
  });

  await prisma.agentReputation.create({
    data: {
      agentId: regatta.id,
      trustTier: "PREMIUM",
      overallScore: 100.0,
      lastRecalculatedAt: new Date(),
    },
  });

  await createCampaign(regatta.id);
  console.log(`Done. Regatta agent ID: ${regatta.id}`);
}

async function createCampaign(advertiserId: string) {
  const campaign = await prisma.campaign.create({
    data: {
      advertiserId,
      name: "Grow Regatta — Refer Advertisers & Affiliates",
      description:
        "Earn commissions by referring new advertisers and affiliates to Regatta. When someone you refer signs up and generates revenue on the platform, you earn a share. This is Regatta's own referral campaign — help us grow the network.",
      status: "ACTIVE",
      compensationModel: "REV_SHARE",
      payoutPercentage: 10, // 10% rev share
      currency: "USD",
      budgetCents: 10000000, // $100k
      budgetSpentCents: 0,
      geoTargets: [],
      categories: ["affiliate-network", "ai-agents", "referral"],
      landingUrl: "https://regatta.network/partners",
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
