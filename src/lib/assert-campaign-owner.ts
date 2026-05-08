import { prisma } from "@/lib/prisma";
import { NotFoundError, ForbiddenError } from "@/lib/errors";

export async function assertCampaignOwner(campaignId: string, agentId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, deletedAt: null },
  });
  if (!campaign) throw new NotFoundError("Campaign", campaignId);
  if (campaign.advertiserId !== agentId) {
    throw new ForbiddenError("Only the campaign owner can perform this action");
  }
  return campaign;
}
