import { z } from "zod";

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export const EvidenceItemSchema = z.object({
  type: z.enum([
    "tweet",
    "blog_post",
    "email",
    "conversation",
    "api_call",
    "code_commit",
  ]),
  url: z.string().url().optional(),
  hash: z.string().max(128).optional(),
  description: z.string().max(2000).optional(),
});

export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

// ---------------------------------------------------------------------------
// Postback
// ---------------------------------------------------------------------------

export const PostbackSchema = z.object({
  rgta_ref: z.string().max(64),
  revenueCents: z.number().int().min(0).optional(),
  externalId: z.string().max(255),
  eventType: z.enum(["PURCHASE", "SIGNUP", "INSTALL", "SUBSCRIPTION", "CUSTOM"]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type PostbackInput = z.infer<typeof PostbackSchema>;

// ---------------------------------------------------------------------------
// Create Referral
// ---------------------------------------------------------------------------

export const CreateReferralSchema = z.object({
  campaignId: z.string().uuid(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  expiresInHours: z.number().int().min(1).default(720),
});

export type CreateReferralInput = z.infer<typeof CreateReferralSchema>;

// ---------------------------------------------------------------------------
// Confirm Referral
// ---------------------------------------------------------------------------

export const ConfirmReferralSchema = z.object({
  revenueCents: z.number().int().min(0).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ConfirmReferralInput = z.infer<typeof ConfirmReferralSchema>;
