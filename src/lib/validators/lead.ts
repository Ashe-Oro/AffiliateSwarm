import { z } from "zod";
import { EvidenceItemSchema } from "./tracking";

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

const LeadStatusEnum = z.enum([
  "SUBMITTED",
  "PENDING_VERIFICATION",
  "VERIFIED",
  "REJECTED",
  "EXPIRED",
  "DISPUTED",
]);

const ActionTypeEnum = z.enum([
  "PURCHASE",
  "SIGNUP",
  "INSTALL",
  "SUBSCRIPTION",
  "CUSTOM",
]);

const ConversionStatusEnum = z.enum([
  "TRACKED",
  "VERIFIED",
  "REJECTED",
  "ATTRIBUTED",
]);

// ---------------------------------------------------------------------------
// Submit Lead
// ---------------------------------------------------------------------------

export const SubmitLeadSchema = z.object({
  campaignId: z.string().uuid(),
  externalId: z.string().max(255).optional(),
  trackingCode: z.string().max(64).optional(),
  leadData: z.record(z.string(), z.unknown()).optional(),
  ipAddress: z.string().max(45).optional(),
  userAgent: z.string().max(2048).optional(),
  geo: z.string().length(2).optional(),
  evidence: z.array(EvidenceItemSchema).max(10).optional(),
});

export type SubmitLeadInput = z.infer<typeof SubmitLeadSchema>;

// ---------------------------------------------------------------------------
// List Leads
// ---------------------------------------------------------------------------

export const ListLeadsSchema = z.object({
  campaignId: z.string().uuid().optional(),
  affiliateId: z.string().uuid().optional(),
  status: LeadStatusEnum.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListLeadsInput = z.infer<typeof ListLeadsSchema>;

// ---------------------------------------------------------------------------
// Verify Lead
// ---------------------------------------------------------------------------

export const VerifyLeadSchema = z.object({
  qualityScore: z.number().int().min(0).max(100).optional(),
  qualitySignals: z.record(z.string(), z.unknown()).optional(),
});

export type VerifyLeadInput = z.infer<typeof VerifyLeadSchema>;

// ---------------------------------------------------------------------------
// Reject Lead
// ---------------------------------------------------------------------------

export const RejectLeadSchema = z.object({
  reason: z.string().max(2000).min(1, "Rejection reason is required"),
});

export type RejectLeadInput = z.infer<typeof RejectLeadSchema>;

// ---------------------------------------------------------------------------
// Dispute Lead
// ---------------------------------------------------------------------------

export const DisputeLeadSchema = z.object({
  reason: z.string().min(1, "Dispute reason is required").max(2000),
});

export type DisputeLeadInput = z.infer<typeof DisputeLeadSchema>;

// ---------------------------------------------------------------------------
// Submit Conversion
// ---------------------------------------------------------------------------

export const SubmitConversionSchema = z.object({
  leadId: z.string().uuid(),
  actionType: ActionTypeEnum,
  conversionData: z.record(z.string(), z.unknown()).optional(),
  revenueCents: z.number().int().min(0).optional(),
  currency: z.string().length(3).default("USD"),
  occurredAt: z.coerce.date().optional(),
});

export type SubmitConversionInput = z.infer<typeof SubmitConversionSchema>;

// ---------------------------------------------------------------------------
// List Conversions
// ---------------------------------------------------------------------------

export const ListConversionsSchema = z.object({
  campaignId: z.string().uuid().optional(),
  affiliateId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  status: ConversionStatusEnum.optional(),
  actionType: ActionTypeEnum.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListConversionsInput = z.infer<typeof ListConversionsSchema>;
