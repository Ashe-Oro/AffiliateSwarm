import { prisma } from "@/lib/prisma";
import type { NotificationEvent, RecipientTarget } from "./events";
import { EVENT_CONFIG } from "./events";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationRecipient {
  agentId: string;
  email: string;
  displayName: string;
  role: "advertiser" | "affiliate";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function lookupAgent(agentId: string): Promise<NotificationRecipient | null> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { id: true, email: true, displayName: true, type: true },
  });
  if (!agent?.email) return null;
  return {
    agentId: agent.id,
    email: agent.email,
    displayName: agent.displayName,
    role: agent.type === "ADVERTISER" ? "advertiser" : "affiliate",
  };
}

async function lookupAdvertiserByCampaign(campaignId: string): Promise<NotificationRecipient | null> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { advertiserId: true },
  });
  if (!campaign) return null;
  return lookupAgent(campaign.advertiserId);
}

// ---------------------------------------------------------------------------
// Main resolver
// ---------------------------------------------------------------------------

function getAdvertiserId(event: NotificationEvent): string | undefined {
  if ("advertiserId" in event.data) return event.data.advertiserId as string;
  return undefined;
}

function getAffiliateId(event: NotificationEvent): string | undefined {
  if ("affiliateId" in event.data) return event.data.affiliateId as string;
  return undefined;
}

function getCampaignId(event: NotificationEvent): string | undefined {
  if ("campaignId" in event.data) return event.data.campaignId as string;
  return undefined;
}

export async function resolveRecipients(
  event: NotificationEvent
): Promise<NotificationRecipient[]> {
  const config = EVENT_CONFIG[event.type];
  const target: RecipientTarget = config.recipients;

  if (target === "none") return [];

  const recipients: NotificationRecipient[] = [];

  if (target === "advertiser" || target === "both") {
    const advertiserId = getAdvertiserId(event);
    const campaignId = getCampaignId(event);

    let advertiser: NotificationRecipient | null = null;
    if (advertiserId) {
      advertiser = await lookupAgent(advertiserId);
    } else if (campaignId) {
      advertiser = await lookupAdvertiserByCampaign(campaignId);
    }
    if (advertiser) {
      advertiser.role = "advertiser";
      recipients.push(advertiser);
    }
  }

  if (target === "affiliate" || target === "both") {
    const affiliateId = getAffiliateId(event);
    if (affiliateId) {
      const affiliate = await lookupAgent(affiliateId);
      if (affiliate) {
        affiliate.role = "affiliate";
        recipients.push(affiliate);
      }
    }
  }

  return recipients;
}
