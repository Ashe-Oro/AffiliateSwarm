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
  console.log("Seeding database...");

  // Clean existing data (in reverse dependency order)
  await prisma.peerRating.deleteMany();
  await prisma.fraudInvestigation.deleteMany();
  await prisma.agentReputation.deleteMany();
  await prisma.escrowHold.deleteMany();
  await prisma.escrowAccount.deleteMany();
  await prisma.verificationTask.deleteMany();
  await prisma.conversionEvent.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.affiliateEnrollment.deleteMany();
  await prisma.payoutRequest.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.rateLimitBucket.deleteMany();
  await prisma.requestLog.deleteMany();
  await prisma.apiSession.deleteMany();
  await prisma.apiCredential.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.domainEvent.deleteMany();
  await prisma.agent.deleteMany();

  // Create advertiser agent
  const advertiser = await prisma.agent.create({
    data: {
      type: "ADVERTISER",
      displayName: "AdBot-3000",
      ownerAccountId: "00000000-0000-0000-0000-000000000001",
      description:
        "Automated advertising agent specializing in high-converting lead campaigns.",
      websiteUrl: "https://adbot3000.example.com",
      status: "ACTIVE",
      verificationLevel: "IDENTITY_VERIFIED",
      capabilities: [
        "CAMPAIGN_CREATE",
        "CAMPAIGN_MANAGE",
        "LEAD_REVIEW",
        "ESCROW_FUND",
      ],
      metadata: {
        webhookUrl: "https://adbot3000.example.com/webhooks",
        sdkVersion: "1.0.0",
      },
    },
  });

  // Create affiliate agent
  const affiliate = await prisma.agent.create({
    data: {
      type: "AFFILIATE",
      displayName: "LeadGen-AI",
      ownerAccountId: "00000000-0000-0000-0000-000000000002",
      description:
        "AI-powered lead generation agent with focus on quality B2B leads.",
      websiteUrl: "https://leadgen-ai.example.com",
      status: "ACTIVE",
      verificationLevel: "EMAIL_VERIFIED",
      capabilities: ["LEAD_SUBMIT", "CAMPAIGN_BROWSE", "CAMPAIGN_ENROLL"],
      metadata: {
        webhookUrl: "https://leadgen-ai.example.com/webhooks",
        sdkVersion: "1.0.0",
      },
    },
  });

  console.log(
    `Created agents: ${advertiser.displayName}, ${affiliate.displayName}`
  );

  // Create campaign (CPL model, $5 per lead, $1000 budget)
  const campaign = await prisma.campaign.create({
    data: {
      advertiserId: advertiser.id,
      name: "Q1 B2B SaaS Lead Campaign",
      description:
        "High-quality B2B SaaS leads for enterprise software. Looking for decision-makers at companies with 50+ employees.",
      status: "ACTIVE",
      compensationModel: "CPL",
      payoutPerUnitCents: 500, // $5.00 per lead
      currency: "USD",
      budgetCents: 100000, // $1,000.00 total budget
      budgetSpentCents: 0,
      dailyCapCount: 50,
      dailyCapCents: 25000, // $250 daily cap
      geoTargets: ["US", "CA", "GB"],
      categories: ["saas", "b2b", "enterprise"],
      landingUrl: "https://adbot3000.example.com/campaigns/q1-b2b-saas",
      enrollmentPolicy: "APPROVAL_REQUIRED",
      requiresVerification: true,
      leadRequirements: {
        requiredFields: ["email", "company", "jobTitle", "companySize"],
        validationRules: {
          emailDomain: "no-free-email",
          companySize: "50+",
        },
        dedupWindowHours: 72,
      },
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
    },
  });

  console.log(`Created campaign: ${campaign.name}`);

  // Create wallets for both agents
  const advertiserWallet = await prisma.wallet.create({
    data: {
      agentId: advertiser.id,
      currency: "USD",
      availableCents: 500000, // $5,000.00
      heldCents: 100000, // $1,000.00 in escrow for the campaign
      pendingPayoutCents: 0,
      status: "ACTIVE",
    },
  });

  const affiliateWallet = await prisma.wallet.create({
    data: {
      agentId: affiliate.id,
      currency: "USD",
      availableCents: 0,
      heldCents: 0,
      pendingPayoutCents: 0,
      status: "ACTIVE",
    },
  });

  console.log(
    `Created wallets: advertiser ($${(advertiserWallet.availableCents / 100).toFixed(2)} available), affiliate ($${(affiliateWallet.availableCents / 100).toFixed(2)} available)`
  );

  // Create reputation records for both agents
  const advertiserReputation = await prisma.agentReputation.create({
    data: {
      agentId: advertiser.id,
      trustTier: "VERIFIED",
      overallScore: 85.0,
      dimensionScores: {
        paymentReliability: 95,
        responseTime: 80,
        campaignQuality: 82,
        disputeResolution: 78,
      },
      totalLeadsSubmitted: 0,
      totalLeadsVerified: 0,
      totalLeadsRejected: 0,
      totalConversions: 0,
      fraudFlagCount: 0,
      reputationHistory: [],
      lastRecalculatedAt: new Date(),
    },
  });

  const affiliateReputation = await prisma.agentReputation.create({
    data: {
      agentId: affiliate.id,
      trustTier: "NEW",
      overallScore: 50.0,
      dimensionScores: {
        leadQuality: 0,
        responseTime: 0,
        reliability: 0,
        communication: 0,
      },
      totalLeadsSubmitted: 0,
      totalLeadsVerified: 0,
      totalLeadsRejected: 0,
      totalConversions: 0,
      fraudFlagCount: 0,
      reputationHistory: [],
      lastRecalculatedAt: new Date(),
    },
  });

  console.log(
    `Created reputation records: ${advertiserReputation.trustTier} (advertiser), ${affiliateReputation.trustTier} (affiliate)`
  );

  // ── AffiliateSwarm's own advertiser account ──
  const affiliateSwarm = await prisma.agent.create({
    data: {
      type: "ADVERTISER",
      displayName: "AffiliateSwarm",
      ownerAccountId: "00000000-0000-0000-0000-000000000003",
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
    data: {
      agentId: affiliateSwarm.id,
      currency: "USD",
      availableCents: 0,
      heldCents: 0,
      pendingPayoutCents: 0,
      status: "ACTIVE",
    },
  });

  await prisma.agentReputation.create({
    data: {
      agentId: affiliateSwarm.id,
      trustTier: "PREMIUM",
      overallScore: 100.0,
      totalLeadsSubmitted: 0,
      totalLeadsVerified: 0,
      totalLeadsRejected: 0,
      totalConversions: 0,
      fraudFlagCount: 0,
      lastRecalculatedAt: new Date(),
    },
  });

  // AffiliateSwarm's "Grow AffiliateSwarm" campaign — affiliates earn for referring new users
  const affiliateSwarmCampaign = await prisma.campaign.create({
    data: {
      advertiserId: affiliateSwarm.id,
      name: "Grow AffiliateSwarm — Refer Advertisers & Affiliates",
      description:
        "Earn commissions by referring new advertisers and affiliates to AffiliateSwarm. When someone you refer signs up and generates revenue on the platform, you earn a share. This is AffiliateSwarm's own referral campaign — help us grow the network.",
      status: "ACTIVE",
      compensationModel: "REV_SHARE",
      payoutPercentage: 10, // 10% revenue share
      currency: "USD",
      budgetCents: 10000000, // $100,000 budget
      budgetSpentCents: 0,
      geoTargets: [],
      categories: ["affiliate-network", "ai-agents", "referral"],
      landingUrl: "https://affiliateswarm.ai/partners",
      enrollmentPolicy: "OPEN",
      requiresVerification: false,
    },
  });

  // Create escrow for the AffiliateSwarm campaign
  await prisma.escrowAccount.create({
    data: {
      campaignId: affiliateSwarmCampaign.id,
      advertiserId: affiliateSwarm.id,
      totalDepositedCents: 10000000,
      currentBalanceCents: 10000000,
      status: "FUNDED",
    },
  });

  console.log(`Created AffiliateSwarm advertiser + "Grow AffiliateSwarm" campaign`);

  console.log("\nSeed completed successfully!");
  console.log({
    agents: 3,
    campaigns: 2,
    wallets: 3,
    reputationRecords: 3,
  });
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
