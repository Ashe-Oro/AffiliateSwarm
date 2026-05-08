import { z } from "zod";

// ---------------------------------------------------------------------------
// Trust Tier enum
// ---------------------------------------------------------------------------

const TrustTierEnum = z.enum(["NEW", "VERIFIED", "TRUSTED", "PREMIUM"]);

// ---------------------------------------------------------------------------
// Fraud enums
// ---------------------------------------------------------------------------

const FraudFlagTypeEnum = z.enum([
  "VELOCITY_ANOMALY",
  "DUPLICATE_PATTERN",
  "GEO_MISMATCH",
  "BOT_SIGNATURE",
  "PAYMENT_FRAUD",
  "DATA_INCONSISTENCY",
]);

const SeverityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

const InvestigationStatusEnum = z.enum([
  "OPEN",
  "UNDER_REVIEW",
  "RESOLVED_CLEAN",
  "RESOLVED_FRAUD",
]);

// ---------------------------------------------------------------------------
// Submit Rating
// ---------------------------------------------------------------------------

export const SubmitRatingSchema = z.object({
  campaignId: z.string().uuid("Invalid campaign ID"),
  score: z.number().int().min(1, "Score must be at least 1").max(5, "Score must be at most 5"),
  dimensions: z
    .record(z.string(), z.number().int().min(1).max(5))
    .optional(),
  comment: z
    .string()
    .max(2000, "Comment must be 2000 characters or fewer")
    .optional(),
});

export type SubmitRatingInput = z.infer<typeof SubmitRatingSchema>;

// ---------------------------------------------------------------------------
// List Ratings
// ---------------------------------------------------------------------------

export const ListRatingsSchema = z.object({
  campaignId: z.string().uuid().optional(),
  minScore: z.coerce.number().int().min(1).max(5).optional(),
  maxScore: z.coerce.number().int().min(1).max(5).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListRatingsInput = z.infer<typeof ListRatingsSchema>;

// ---------------------------------------------------------------------------
// Flag Fraud
// ---------------------------------------------------------------------------

export const FlagFraudSchema = z.object({
  type: FraudFlagTypeEnum,
  severity: SeverityEnum,
  triggerEvent: z.string().min(1, "Trigger event description is required").max(5000),
  signals: z
    .array(
      z.object({
        signalType: z.string(),
        confidence: z.number().min(0).max(1),
        evidence: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .optional(),
});

export type FlagFraudInput = z.infer<typeof FlagFraudSchema>;

// ---------------------------------------------------------------------------
// List Fraud Investigations
// ---------------------------------------------------------------------------

export const ListFraudInvestigationsSchema = z.object({
  status: InvestigationStatusEnum.optional(),
  severity: SeverityEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListFraudInvestigationsInput = z.infer<typeof ListFraudInvestigationsSchema>;
