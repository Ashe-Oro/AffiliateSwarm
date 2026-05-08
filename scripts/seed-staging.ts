/**
 * Seed staging environment with realistic test data.
 * Creates 10 advertisers with campaigns, 5 affiliates, enrollments, clicks, and leads.
 *
 * Usage: DATABASE_URL="..." npx tsx scripts/seed-staging.ts
 */
import "dotenv/config";
import { randomBytes, randomUUID } from "crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter }) as PrismaClient;

const API_KEY_PREFIX = "rgt_live_";

async function generateKey() {
  const { nanoid } = await import("nanoid");
  const randomPart = nanoid(32);
  const key = `${API_KEY_PREFIX}${randomPart}`;
  const keyPrefix = randomPart.slice(0, 8); // must match extractKeyPrefix logic
  const hash = await bcrypt.hash(key, 12);
  const hmacSecret = randomBytes(32).toString("hex");
  return { key, prefix: keyPrefix, hash, hmacSecret };
}

interface AdvertiserDef {
  name: string;
  description: string;
  website: string;
  campaign: {
    name: string;
    description: string;
    model: "CPL" | "CPA" | "CPC" | "REV_SHARE";
    payoutCents: number;
    budgetCents: number;
    landingUrl: string;
    categories: string[];
    geoTargets: string[];
  };
}

const advertisers: AdvertiserDef[] = [
  {
    name: "Venice AI",
    description: "Private, uncensored AI platform. Privacy-first generative AI.",
    website: "https://venice.ai",
    campaign: {
      name: "Venice AI — Pro Subscriptions",
      description: "Drive paid subscriptions to Venice AI Pro. $15 per signup that converts to a paid plan within 30 days.",
      model: "CPA",
      payoutCents: 1500,
      budgetCents: 5000000,
      landingUrl: "https://venice.ai/pricing",
      categories: ["ai", "privacy", "saas"],
      geoTargets: ["US", "CA", "GB", "DE"],
    },
  },
  {
    name: "N8N Cloud",
    description: "Workflow automation platform. Self-hosted or cloud.",
    website: "https://n8n.io",
    campaign: {
      name: "N8N Cloud — Free Trial Signups",
      description: "Get users to start a free trial of N8N Cloud. $5 per verified signup.",
      model: "CPL",
      payoutCents: 500,
      budgetCents: 2000000,
      landingUrl: "https://n8n.io/cloud",
      categories: ["automation", "saas", "devtools"],
      geoTargets: ["US", "CA", "GB", "DE", "FR"],
    },
  },
  {
    name: "Bolt.new",
    description: "AI-powered full-stack web development in the browser.",
    website: "https://bolt.new",
    campaign: {
      name: "Bolt.new — Developer Signups",
      description: "Drive developer signups to Bolt.new. CPA on first project created.",
      model: "CPA",
      payoutCents: 800,
      budgetCents: 3000000,
      landingUrl: "https://bolt.new",
      categories: ["ai", "devtools", "saas"],
      geoTargets: ["US", "CA", "GB"],
    },
  },
  {
    name: "Cursor",
    description: "The AI-first code editor. Built for pair programming with AI.",
    website: "https://cursor.com",
    campaign: {
      name: "Cursor Pro — Paid Subscriptions",
      description: "25% revenue share on Cursor Pro subscriptions from referred users.",
      model: "REV_SHARE",
      payoutCents: 2500, // 25% in basis points
      budgetCents: 10000000,
      landingUrl: "https://cursor.com/pricing",
      categories: ["ai", "devtools", "ide"],
      geoTargets: [],
    },
  },
  {
    name: "Shopify Gadget Store",
    description: "Premium tech gadgets and accessories. Shopify-powered e-commerce.",
    website: "https://gadgetstore.example.com",
    campaign: {
      name: "Gadget Store — Purchase Commissions",
      description: "10% revenue share on all purchases from referred customers.",
      model: "REV_SHARE",
      payoutCents: 1000, // 10% in basis points
      budgetCents: 1000000,
      landingUrl: "https://gadgetstore.example.com",
      categories: ["ecommerce", "gadgets", "tech"],
      geoTargets: ["US"],
    },
  },
  {
    name: "Replit",
    description: "Build software collaboratively from anywhere in the world.",
    website: "https://replit.com",
    campaign: {
      name: "Replit Teams — Enterprise Leads",
      description: "Generate qualified leads for Replit Teams. $20 per lead with company email.",
      model: "CPL",
      payoutCents: 2000,
      budgetCents: 5000000,
      landingUrl: "https://replit.com/teams",
      categories: ["devtools", "saas", "enterprise"],
      geoTargets: ["US", "CA", "GB", "DE", "AU"],
    },
  },
  {
    name: "Vercel",
    description: "The frontend cloud. Build, scale, and secure web experiences.",
    website: "https://vercel.com",
    campaign: {
      name: "Vercel Pro — Developer Signups",
      description: "Drive signups to Vercel Pro. $10 per developer who upgrades from free.",
      model: "CPA",
      payoutCents: 1000,
      budgetCents: 8000000,
      landingUrl: "https://vercel.com/pricing",
      categories: ["devtools", "cloud", "saas"],
      geoTargets: [],
    },
  },
  {
    name: "Supabase",
    description: "The open source Firebase alternative. Postgres database, auth, storage.",
    website: "https://supabase.com",
    campaign: {
      name: "Supabase Pro — Database Signups",
      description: "Get developers to sign up for Supabase Pro. $8 per paid conversion.",
      model: "CPA",
      payoutCents: 800,
      budgetCents: 4000000,
      landingUrl: "https://supabase.com/pricing",
      categories: ["database", "saas", "devtools"],
      geoTargets: [],
    },
  },
  {
    name: "Midjourney",
    description: "AI image generation. Create stunning visuals from text prompts.",
    website: "https://midjourney.com",
    campaign: {
      name: "Midjourney — Subscription Referrals",
      description: "20% revenue share on subscription payments from referred users for the first 6 months.",
      model: "REV_SHARE",
      payoutCents: 2000,
      budgetCents: 15000000,
      landingUrl: "https://midjourney.com",
      categories: ["ai", "creative", "design"],
      geoTargets: [],
    },
  },
  {
    name: "HomeReno Pro",
    description: "Local home renovation contractors. Kitchen and bath remodeling.",
    website: "https://homereno.example.com",
    campaign: {
      name: "HomeReno Pro — Qualified Leads",
      description: "Cost per lead for homeowners interested in kitchen/bath renovation. $25 per qualified lead with phone number.",
      model: "CPL",
      payoutCents: 2500,
      budgetCents: 500000,
      landingUrl: "https://homereno.example.com/get-quote",
      categories: ["home", "construction", "local"],
      geoTargets: ["US"],
    },
  },
  {
    name: "CryptoTracker",
    description: "Portfolio tracking and tax reporting for crypto investors.",
    website: "https://cryptotracker.example.com",
    campaign: {
      name: "CryptoTracker — Click Traffic",
      description: "Drive traffic to our landing page. $0.25 per verified click.",
      model: "CPC",
      payoutCents: 25,
      budgetCents: 250000,
      landingUrl: "https://cryptotracker.example.com",
      categories: ["crypto", "fintech", "saas"],
      geoTargets: ["US", "CA", "GB", "AU"],
    },
  },
];

interface AffiliateDef {
  name: string;
  description: string;
}

const affiliates: AffiliateDef[] = [
  { name: "TechReview Bot", description: "AI-powered tech review publisher. Covers SaaS, devtools, and AI products." },
  { name: "CryptoAlpha Agent", description: "Crypto and fintech content automation. Newsletter and social media." },
  { name: "DevTools Weekly", description: "Automated weekly roundup of developer tools and productivity software." },
  { name: "AI Insider", description: "Deep coverage of AI products, comparisons, and recommendations." },
  { name: "DigitalNomad Hub", description: "Content for remote workers. Software recommendations and productivity tips." },
];

async function main() {
  console.log("Seeding staging environment...\n");

  const createdAdvertisers: { agentId: string; apiKey: string; campaignId: string; def: AdvertiserDef }[] = [];
  const createdAffiliates: { agentId: string; apiKey: string; def: AffiliateDef }[] = [];

  // Create advertisers with campaigns
  for (const adv of advertisers) {
    // Check if already exists
    const existing = await prisma.agent.findFirst({
      where: { displayName: adv.name, deletedAt: null },
    });
    if (existing) {
      console.log(`  [skip] ${adv.name} already exists`);
      const campaign = await prisma.campaign.findFirst({
        where: { advertiserId: existing.id, deletedAt: null },
      });
      createdAdvertisers.push({
        agentId: existing.id,
        apiKey: "(existing)",
        campaignId: campaign?.id ?? "",
        def: adv,
      });
      continue;
    }

    const key = await generateKey();

    const agent = await prisma.agent.create({
      data: {
        type: "ADVERTISER",
        displayName: adv.name,
        ownerAccountId: randomUUID(),
        description: adv.description,
        websiteUrl: adv.website,
        status: "ACTIVE",
        accountGate: "LIVE",
        verificationLevel: "IDENTITY_VERIFIED",
        capabilities: ["CAMPAIGN_CREATE", "CAMPAIGN_MANAGE", "LEAD_REVIEW"],
      },
    });

    await prisma.apiCredential.create({
      data: {
        agentId: agent.id,
        apiKeyHash: key.hash,
        apiKeyPrefix: key.prefix,
        hmacSecret: key.hmacSecret,
        label: "Default API Key",
        scopes: ["*"],
      },
    });

    await prisma.wallet.create({
      data: {
        agentId: agent.id,
        availableCents: adv.campaign.budgetCents,
        status: "ACTIVE",
      },
    });

    await prisma.agentReputation.create({
      data: {
        agentId: agent.id,
        trustTier: "VERIFIED",
        overallScore: 75 + Math.random() * 25,
        lastRecalculatedAt: new Date(),
      },
    });

    const campaign = await prisma.campaign.create({
      data: {
        advertiserId: agent.id,
        name: adv.campaign.name,
        description: adv.campaign.description,
        status: "ACTIVE",
        compensationModel: adv.campaign.model,
        payoutPerUnitCents: adv.campaign.payoutCents,
        budgetCents: adv.campaign.budgetCents,
        landingUrl: adv.campaign.landingUrl,
        categories: adv.campaign.categories,
        geoTargets: adv.campaign.geoTargets,
        enrollmentPolicy: "APPROVAL_REQUIRED",
        requiresVerification: true,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.escrowAccount.create({
      data: {
        campaignId: campaign.id,
        advertiserId: agent.id,
        totalDepositedCents: adv.campaign.budgetCents,
        currentBalanceCents: adv.campaign.budgetCents,
        status: "FUNDED",
      },
    });

    createdAdvertisers.push({ agentId: agent.id, apiKey: key.key, campaignId: campaign.id, def: adv });
    console.log(`  [created] ${adv.name} — campaign: ${adv.campaign.name}`);
  }

  console.log(`\n${createdAdvertisers.length} advertisers ready.\n`);

  // Create affiliates
  for (const aff of affiliates) {
    const existing = await prisma.agent.findFirst({
      where: { displayName: aff.name, deletedAt: null },
    });
    if (existing) {
      console.log(`  [skip] ${aff.name} already exists`);
      createdAffiliates.push({ agentId: existing.id, apiKey: "(existing)", def: aff });
      continue;
    }

    const key = await generateKey();

    const agent = await prisma.agent.create({
      data: {
        type: "AFFILIATE",
        displayName: aff.name,
        ownerAccountId: randomUUID(),
        description: aff.description,
        status: "ACTIVE",
        verificationLevel: "EMAIL_VERIFIED",
        capabilities: ["LEAD_SUBMIT", "CAMPAIGN_BROWSE", "CAMPAIGN_ENROLL"],
      },
    });

    await prisma.apiCredential.create({
      data: {
        agentId: agent.id,
        apiKeyHash: key.hash,
        apiKeyPrefix: key.prefix,
        hmacSecret: key.hmacSecret,
        label: "Default API Key",
        scopes: ["*"],
      },
    });

    await prisma.wallet.create({
      data: { agentId: agent.id, status: "ACTIVE" },
    });

    await prisma.agentReputation.create({
      data: {
        agentId: agent.id,
        trustTier: "NEW",
        overallScore: 40 + Math.random() * 30,
        lastRecalculatedAt: new Date(),
      },
    });

    createdAffiliates.push({ agentId: agent.id, apiKey: key.key, def: aff });
    console.log(`  [created] ${aff.name}`);
  }

  console.log(`\n${createdAffiliates.length} affiliates ready.\n`);

  // Enroll affiliates in campaigns (each affiliate applies to 3-4 random campaigns)
  let enrollmentCount = 0;
  for (const aff of createdAffiliates) {
    const shuffled = [...createdAdvertisers].sort(() => Math.random() - 0.5);
    const toEnroll = shuffled.slice(0, 3 + Math.floor(Math.random() * 2));

    for (const adv of toEnroll) {
      if (!adv.campaignId) continue;

      const existing = await prisma.affiliateEnrollment.findUnique({
        where: {
          campaignId_affiliateId: {
            campaignId: adv.campaignId,
            affiliateId: aff.agentId,
          },
        },
      });
      if (existing) continue;

      const trackingCode = randomBytes(32).toString("hex");

      await prisma.affiliateEnrollment.create({
        data: {
          campaignId: adv.campaignId,
          affiliateId: aff.agentId,
          status: "APPROVED",
          trackingCode,
          approvedAt: new Date(),
          pitch: `${aff.def.name} would be a great fit for ${adv.def.campaign.name}. We have strong reach in the ${adv.def.campaign.categories[0]} space.`,
        },
      });
      enrollmentCount++;

      // Create some click events (5-20 per enrollment)
      const clickCount = 5 + Math.floor(Math.random() * 16);
      for (let i = 0; i < clickCount; i++) {
        const daysAgo = Math.floor(Math.random() * 14);
        await prisma.clickEvent.create({
          data: {
            trackingCode,
            campaignId: adv.campaignId,
            affiliateId: aff.agentId,
            ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
            userAgent: "Mozilla/5.0 (compatible; TestBot/1.0)",
            referer: ["https://twitter.com", "https://reddit.com", "https://news.ycombinator.com", "https://medium.com"][Math.floor(Math.random() * 4)],
            geo: adv.def.campaign.geoTargets[0] || "US",
            clickedAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
          },
        });
      }

      // Create some leads (1-5 per enrollment, some verified)
      const leadCount = 1 + Math.floor(Math.random() * 5);
      for (let i = 0; i < leadCount; i++) {
        const isVerified = Math.random() > 0.3;
        const daysAgo = Math.floor(Math.random() * 10);

        await prisma.lead.create({
          data: {
            campaignId: adv.campaignId,
            affiliateId: aff.agentId,
            trackingCode,
            externalId: `test-${randomUUID().slice(0, 8)}`,
            status: isVerified ? "VERIFIED" : "SUBMITTED",
            verifiedAt: isVerified ? new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000) : undefined,
            payoutCents: adv.def.campaign.payoutCents,
            leadData: { email: `user${Math.floor(Math.random() * 10000)}@example.com`, source: "test-seed" },
            submittedAt: new Date(Date.now() - (daysAgo + 1) * 24 * 60 * 60 * 1000),
          },
        });
      }
    }
  }

  console.log(`${enrollmentCount} enrollments created with clicks and leads.\n`);

  // Create a partner
  const existingPartner = await prisma.partner.findUnique({ where: { referralCode: "TESTPARTNER" } });
  if (!existingPartner) {
    await prisma.partner.create({
      data: {
        displayName: "Test KOL Partner",
        email: "testkol@example.com",
        referralCode: "TESTPARTNER",
        revenueShareBps: 1000,
        bio: "AI agent KOL with 50k followers. Covers OpenClaw and agent tooling.",
        websiteUrl: "https://testkol.example.com",
      },
    });
    console.log("Created test partner (code: TESTPARTNER)\n");
  }

  // Save API keys for E2E testing
  const testKeys = {
    advertisers: createdAdvertisers
      .filter((a) => a.apiKey !== "(existing)")
      .map((a) => ({ name: a.def.name, agentId: a.agentId, apiKey: a.apiKey, campaignId: a.campaignId })),
    affiliates: createdAffiliates
      .filter((a) => a.apiKey !== "(existing)")
      .map((a) => ({ name: a.def.name, agentId: a.agentId, apiKey: a.apiKey })),
  };

  if (testKeys.advertisers.length > 0 || testKeys.affiliates.length > 0) {
    const fs = await import("fs");
    fs.writeFileSync(
      "scripts/staging-keys.json",
      JSON.stringify(testKeys, null, 2)
    );
    console.log("API keys saved to scripts/staging-keys.json\n");
  }

  console.log("Staging seed complete!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
