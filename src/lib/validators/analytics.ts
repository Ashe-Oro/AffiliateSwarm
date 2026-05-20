import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

const GranularityEnum = z.enum(["day", "week", "month"]);

// ---------------------------------------------------------------------------
// Analytics Overview
// ---------------------------------------------------------------------------

export const AnalyticsOverviewSchema = z.object({
  agentId: z.string().uuid().optional(),
  role: z.enum(["ADVERTISER", "AFFILIATE", "DUAL"]).optional(),
});

export type AnalyticsOverviewInput = z.infer<typeof AnalyticsOverviewSchema>;

// ---------------------------------------------------------------------------
// Campaign Analytics
// ---------------------------------------------------------------------------

export const CampaignAnalyticsSchema = z.object({
  campaignId: z.string().uuid(),
});

export type CampaignAnalyticsInput = z.infer<typeof CampaignAnalyticsSchema>;

// ---------------------------------------------------------------------------
// Timeseries
// ---------------------------------------------------------------------------

export const TimeseriesSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  granularity: GranularityEnum.default("day"),
  campaignId: z.string().uuid().optional(),
  affiliateId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  role: z.enum(["ADVERTISER", "AFFILIATE", "DUAL"]).optional(),
});

export type TimeseriesInput = z.infer<typeof TimeseriesSchema>;
