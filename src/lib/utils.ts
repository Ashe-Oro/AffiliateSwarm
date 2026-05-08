import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Human-readable payout description for a campaign. The REV_SHARE enum pays a
 * one-time percentage of the triggering conversion's reported revenue — it is
 * not a recurring revenue share — so we display it as "% of initial sale".
 */
export function formatCampaignPayout(campaign: {
  compensationModel: string;
  payoutPerUnitCents: number | null;
  payoutPercentage: number | null;
  currency?: string;
}): string {
  if (campaign.compensationModel === "REV_SHARE") {
    if (campaign.payoutPercentage == null) return "—";
    return `${campaign.payoutPercentage}% of initial sale`;
  }
  if (campaign.payoutPerUnitCents == null) return "—";
  return formatCents(campaign.payoutPerUnitCents, campaign.currency ?? "USD");
}
