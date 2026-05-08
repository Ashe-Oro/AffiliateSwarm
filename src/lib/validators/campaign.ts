import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

const CompensationModelEnum = z.enum(["CPL", "CPA", "CPC", "REV_SHARE"]);
const BuyerIncentiveTypeEnum = z.enum([
  "PERCENTAGE_OFF",
  "FIXED_AMOUNT_OFF",
  "FREE_TRIAL",
  "CUSTOM",
]);

// Stripe coupon ID format: alphanumeric, underscore, hyphen.
const BuyerCouponCodeSchema = z
  .string()
  .max(100)
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "Coupon code must contain only letters, numbers, underscores, or hyphens"
  );

function validateIncentiveValue(
  type: string | null | undefined,
  value: string | null | undefined,
  ctx: z.RefinementCtx
) {
  if (!type) return;
  const trimmed = value?.trim() ?? "";
  if (type !== "CUSTOM" && trimmed === "") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["buyerIncentiveValue"],
      message: "Incentive value is required for this incentive type",
    });
    return;
  }
  if (type === "PERCENTAGE_OFF") {
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0 || n > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["buyerIncentiveValue"],
        message: "Percentage off must be a number between 1 and 100",
      });
    }
  } else if (type === "FIXED_AMOUNT_OFF") {
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["buyerIncentiveValue"],
        message: "Fixed amount off must be a positive number",
      });
    }
  } else if (type === "FREE_TRIAL") {
    const n = Number(trimmed);
    if (!Number.isInteger(n) || n <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["buyerIncentiveValue"],
        message: "Free trial duration must be a positive integer (days)",
      });
    }
  }
}
export function validateCompensationFields(
  data: {
    compensationModel?: "CPL" | "CPA" | "CPC" | "REV_SHARE";
    payoutPerUnitCents?: number | null;
    payoutPercentage?: number | null;
  },
  ctx: z.RefinementCtx
) {
  if (!data.compensationModel) return;
  if (data.compensationModel === "REV_SHARE") {
    if (data.payoutPercentage == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payoutPercentage"],
        message:
          "payoutPercentage is required when compensationModel is REV_SHARE (integer 1-100)",
      });
    }
    if (data.payoutPerUnitCents != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payoutPerUnitCents"],
        message:
          "payoutPerUnitCents must not be set for REV_SHARE campaigns; use payoutPercentage",
      });
    }
  } else {
    if (data.payoutPerUnitCents == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payoutPerUnitCents"],
        message:
          "payoutPerUnitCents is required for CPL/CPA/CPC campaigns",
      });
    }
    if (data.payoutPercentage != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payoutPercentage"],
        message:
          "payoutPercentage is only valid for REV_SHARE campaigns",
      });
    }
  }
}

const CampaignStatusEnum = z.enum([
  "DRAFT",
  "PENDING_ESCROW",
  "ACTIVE",
  "PAUSED",
  "BUDGET_EXHAUSTED",
  "COMPLETED",
  "CANCELLED",
]);
const EnrollmentPolicyEnum = z.enum(["OPEN", "APPROVAL_REQUIRED", "INVITE_ONLY"]);

// ---------------------------------------------------------------------------
// Create Campaign
// ---------------------------------------------------------------------------

export const CreateCampaignSchema = z
  .object({
  name: z
    .string()
    .min(1, "Campaign name is required")
    .max(255, "Campaign name must be 255 characters or fewer"),
  description: z.string().max(5000).optional(),
  compensationModel: CompensationModelEnum,
  payoutPerUnitCents: z
    .number()
    .int()
    .min(1, "Payout per unit must be positive")
    .optional(),
  payoutPercentage: z
    .number()
    .int()
    .min(1, "Payout percentage must be at least 1%")
    .max(100, "Payout percentage cannot exceed 100%")
    .optional(),
  currency: z.string().length(3).default("USD"),
  budgetCents: z.number().int().min(1, "Budget must be positive"),
  dailyCapCount: z.number().int().min(1).nullish(),
  dailyCapCents: z.number().int().min(1).nullish(),
  geoTargets: z.array(z.string().length(2)).optional(),
  categories: z.array(z.string().max(100)).optional(),
  landingUrl: z.string().url().max(2048).optional(),
  productUrl: z.string().url().max(2048).optional(),
  conversionAction: z.string().max(100).optional(),
  productDescription: z.string().max(5000).optional(),
  brandAssets: z.record(z.string(), z.unknown()).optional(),
  buyerIncentiveType: BuyerIncentiveTypeEnum.optional(),
  buyerIncentiveValue: z.string().max(255).optional(),
  buyerIncentiveLabel: z.string().max(255).optional(),
  buyerCouponCode: BuyerCouponCodeSchema.optional(),
  holdingPeriodDays: z.number().int().min(0).max(90).default(30),
  enrollmentPolicy: EnrollmentPolicyEnum.default("APPROVAL_REQUIRED"),
  requiresVerification: z.boolean().default(true),
  leadRequirements: z.record(z.string(), z.unknown()).optional(),
  targetingCriteria: z.record(z.string(), z.unknown()).optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
})
  .superRefine((data, ctx) => {
    validateIncentiveValue(data.buyerIncentiveType, data.buyerIncentiveValue, ctx);
    validateCompensationFields(data, ctx);
  });

export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>;

// ---------------------------------------------------------------------------
// Update Campaign
// ---------------------------------------------------------------------------

export const UpdateCampaignSchema = z
  .object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).nullish(),
  payoutPerUnitCents: z.number().int().min(1).optional(),
  payoutPercentage: z.number().int().min(1).max(100).optional(),
  budgetCents: z.number().int().min(1).optional(),
  dailyCapCount: z.number().int().min(1).nullish(),
  dailyCapCents: z.number().int().min(1).nullish(),
  geoTargets: z.array(z.string().length(2)).optional(),
  categories: z.array(z.string().max(100)).optional(),
  landingUrl: z.string().url().max(2048).nullish(),
  productUrl: z.string().url().max(2048).nullish(),
  conversionAction: z.string().max(100).nullish(),
  productDescription: z.string().max(5000).nullish(),
  brandAssets: z.record(z.string(), z.unknown()).nullish(),
  buyerIncentiveType: BuyerIncentiveTypeEnum.nullish(),
  buyerIncentiveValue: z.string().max(255).nullish(),
  buyerIncentiveLabel: z.string().max(255).nullish(),
  buyerCouponCode: BuyerCouponCodeSchema.nullish(),
  holdingPeriodDays: z.number().int().min(0).max(90).optional(),
  enrollmentPolicy: EnrollmentPolicyEnum.optional(),
  requiresVerification: z.boolean().optional(),
  leadRequirements: z.record(z.string(), z.unknown()).nullish(),
  targetingCriteria: z.record(z.string(), z.unknown()).nullish(),
  startsAt: z.coerce.date().nullish(),
  endsAt: z.coerce.date().nullish(),
})
  .superRefine((data, ctx) => {
    validateIncentiveValue(data.buyerIncentiveType, data.buyerIncentiveValue, ctx);
    if (data.payoutPerUnitCents != null && data.payoutPercentage != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payoutPercentage"],
        message:
          "Cannot set both payoutPerUnitCents and payoutPercentage in the same update; only one applies per compensation model",
      });
    }
  });

export type UpdateCampaignInput = z.infer<typeof UpdateCampaignSchema>;

// ---------------------------------------------------------------------------
// Discover Campaigns (public listing for affiliates)
// ---------------------------------------------------------------------------

export const DiscoverCampaignsSchema = z.object({
  compensationModel: CompensationModelEnum.optional(),
  category: z.string().max(100).optional(),
  geo: z.string().length(2).optional(),
  query: z.string().max(255).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type DiscoverCampaignsInput = z.infer<typeof DiscoverCampaignsSchema>;

// ---------------------------------------------------------------------------
// List Own Campaigns
// ---------------------------------------------------------------------------

export const ListCampaignsSchema = z.object({
  status: CampaignStatusEnum.optional(),
  compensationModel: CompensationModelEnum.optional(),
  category: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListCampaignsInput = z.infer<typeof ListCampaignsSchema>;

// ---------------------------------------------------------------------------
// Apply to Campaign
// ---------------------------------------------------------------------------

export const ApplyToCampaignSchema = z.object({
  pitch: z.string().max(5000).optional(),
  customTerms: z.record(z.string(), z.unknown()).optional(),
});

export type ApplyToCampaignInput = z.infer<typeof ApplyToCampaignSchema>;

// ---------------------------------------------------------------------------
// Review Application
// ---------------------------------------------------------------------------

export const ReviewApplicationSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  revokeReason: z.string().max(2000).optional(),
});

export type ReviewApplicationInput = z.infer<typeof ReviewApplicationSchema>;
