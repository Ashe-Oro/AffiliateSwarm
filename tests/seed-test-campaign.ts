/**
 * Seed a fully funded test campaign for E2E testing.
 * Creates an advertiser, funds the escrow directly (no Stripe needed),
 * activates the campaign, and saves API keys for test scripts.
 *
 * Usage: npx tsx tests/seed-test-campaign.ts
 *
 * Idempotent — skips if "E2E Test Advertiser" already exists.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "crypto";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter }) as PrismaClient;

const API_KEY_PREFIX = "swarm_live_";

async function generateKey() {
  const randomPart = nanoid(32);
  const key = `${API_KEY_PREFIX}${randomPart}`;
  const keyPrefix = randomPart.slice(0, 8);
  const hash = await bcrypt.hash(key, 12);
  const hmacSecret = randomBytes(32).toString("hex");
  return { key, prefix: keyPrefix, hash, hmacSecret };
}

async function main() {
  // Check if already seeded
  const existing = await prisma.agent.findFirst({
    where: { displayName: "E2E Test Advertiser", deletedAt: null },
  });

  if (existing) {
    console.log("Test campaign already seeded. Delete it first to re-seed.");
    const cred = await prisma.apiCredential.findFirst({
      where: { agentId: existing.id },
      select: { apiKeyPrefix: true },
    });
    console.log(`Advertiser ID: ${existing.id} (key prefix: ${cred?.apiKeyPrefix})`);

    // Check for affiliate
    const aff = await prisma.agent.findFirst({
      where: { displayName: "E2E Test Affiliate", deletedAt: null },
    });
    if (aff) {
      console.log(`Affiliate ID: ${aff.id}`);
    }
    return;
  }

  console.log("Seeding E2E test campaign...\n");

  // Create test partner
  const partner = await prisma.partner.upsert({
    where: { referralCode: "E2ETEST" },
    create: {
      displayName: "E2E Test Partner",
      email: "e2e-partner@test.affiliateswarm.dev",
      referralCode: "E2ETEST",
      revenueShareBps: 1000,
    },
    update: {},
  });
  console.log(`Partner: ${partner.referralCode}`);

  // Create advertiser
  const advKey = await generateKey();
  const advertiser = await prisma.agent.create({
    data: {
      type: "ADVERTISER",
      displayName: "E2E Test Advertiser",
      ownerAccountId: randomUUID(),
      email: "e2e-advertiser@test.affiliateswarm.dev",
      status: "ACTIVE",
      accountGate: "LIVE",
      verificationLevel: "IDENTITY_VERIFIED",
      capabilities: ["CAMPAIGN_CREATE", "CAMPAIGN_MANAGE", "LEAD_REVIEW"],
    },
  });

  await prisma.apiCredential.create({
    data: {
      agentId: advertiser.id,
      apiKeyHash: advKey.hash,
      apiKeyPrefix: advKey.prefix,
      hmacSecret: advKey.hmacSecret,
      label: "Default API Key",
      scopes: ["*"],
    },
  });

  await prisma.wallet.create({
    data: { agentId: advertiser.id, availableCents: 1000000, status: "ACTIVE" },
  });

  await prisma.agentReputation.create({
    data: { agentId: advertiser.id, trustTier: "VERIFIED", overallScore: 85, lastRecalculatedAt: new Date() },
  });

  // Create campaign with funded escrow
  const campaign = await prisma.campaign.create({
    data: {
      advertiserId: advertiser.id,
      name: "E2E Test Campaign — $10 CPA",
      description: "Pre-funded test campaign for E2E testing. Open enrollment.",
      status: "ACTIVE",
      compensationModel: "CPA",
      payoutPerUnitCents: 1000,
      budgetCents: 1000000,
      landingUrl: "https://affiliateswarm.ai/demo/landing",
      categories: ["testing", "e2e"],
      geoTargets: [],
      enrollmentPolicy: "OPEN",
      requiresVerification: false,
      holdingPeriodDays: 0, // immediate release for E2E testing
      trackingConfirmedAt: new Date(),
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.escrowAccount.upsert({
    where: { campaignId: campaign.id },
    create: {
      campaignId: campaign.id,
      advertiserId: advertiser.id,
      totalDepositedCents: 1000000,
      currentBalanceCents: 1000000,
      status: "FUNDED",
    },
    update: {
      totalDepositedCents: 1000000,
      currentBalanceCents: 1000000,
      status: "FUNDED",
    },
  });

  console.log(`Advertiser: ${advertiser.id}`);
  console.log(`Campaign: ${campaign.id} (ACTIVE, $10k funded)`);

  // Create affiliate (referred by test partner)
  const affKey = await generateKey();
  const affiliate = await prisma.agent.create({
    data: {
      type: "AFFILIATE",
      displayName: "E2E Test Affiliate",
      ownerAccountId: randomUUID(),
      email: "e2e-affiliate@test.affiliateswarm.dev",
      status: "ACTIVE",
      verificationLevel: "EMAIL_VERIFIED",
      capabilities: ["LEAD_SUBMIT", "CAMPAIGN_BROWSE", "CAMPAIGN_ENROLL"],
    },
  });

  await prisma.apiCredential.create({
    data: {
      agentId: affiliate.id,
      apiKeyHash: affKey.hash,
      apiKeyPrefix: affKey.prefix,
      hmacSecret: affKey.hmacSecret,
      label: "Default API Key",
      scopes: ["*"],
    },
  });

  await prisma.wallet.create({
    data: { agentId: affiliate.id, status: "ACTIVE" },
  });

  await prisma.agentReputation.create({
    data: { agentId: affiliate.id, trustTier: "NEW", overallScore: 50, lastRecalculatedAt: new Date() },
  });

  // Track partner referral
  await prisma.partnerReferral.create({
    data: { partnerId: partner.id, agentId: affiliate.id, agentType: "AFFILIATE" },
  });

  console.log(`Affiliate: ${affiliate.id} (referred by ${partner.referralCode})`);

  // Save keys
  const testKeys = {
    advertiser: { agentId: advertiser.id, apiKey: advKey.key, campaignId: campaign.id },
    affiliate: { agentId: affiliate.id, apiKey: affKey.key },
    partner: { referralCode: partner.referralCode },
  };

  const fs = await import("fs");
  fs.writeFileSync("tests/e2e-test-keys.json", JSON.stringify(testKeys, null, 2));

  console.log("\nKeys saved to tests/e2e-test-keys.json");
  console.log("\nRun the E2E test:");
  console.log("  npx next dev --port 3099 &");
  console.log("  npx tsx tests/e2e-test.ts");
}

main()
  .catch((e) => { console.error("Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
