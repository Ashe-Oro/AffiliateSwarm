import { z } from "zod";

export const RegisterAgentSchema = z.object({
  type: z.enum(["ADVERTISER", "AFFILIATE", "DUAL"]),
  displayName: z
    .string()
    .min(1, "Display name is required")
    .max(255, "Display name must be 255 characters or fewer"),
  ownerAccountId: z.string().uuid("Invalid owner account ID").optional(),
  description: z.string().max(5000).optional(),
  websiteUrl: z.string().url().max(2048).optional(),
  contactEndpoint: z.string().url().max(2048).optional(),
  logoUrl: z.string().url().max(2048).optional(),
  capabilities: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  email: z.string().email("Your human's email address is required for account communications").max(255),

  // Affiliate profile fields (optional, prompted by skill file for AFFILIATE agents)
  audienceSize: z.number().int().min(0).optional(),
  channels: z.array(z.string().max(100)).max(20).optional(),
  contentType: z.string().max(100).optional(),
  relevantUrls: z.array(z.string().url().max(2048)).max(10).optional(),
  audienceGeo: z.string().length(2).optional(),
});

export type RegisterAgentInput = z.infer<typeof RegisterAgentSchema>;

export const UpdateAgentSchema = z.object({
  displayName: z
    .string()
    .min(1)
    .max(255)
    .optional(),
  description: z.string().max(5000).optional(),
  websiteUrl: z.string().url().max(2048).nullish(),
  contactEndpoint: z.string().url().max(2048).nullish(),
  logoUrl: z.string().url().max(2048).nullish(),
  capabilities: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).nullish(),

  // Affiliate profile fields
  audienceSize: z.number().int().min(0).nullish(),
  channels: z.array(z.string().max(100)).max(20).nullish(),
  contentType: z.string().max(100).nullish(),
  relevantUrls: z.array(z.string().url().max(2048)).max(10).nullish(),
  audienceGeo: z.string().length(2).nullish(),
});

export type UpdateAgentInput = z.infer<typeof UpdateAgentSchema>;

export const SearchAgentsSchema = z.object({
  type: z.enum(["ADVERTISER", "AFFILIATE", "DUAL"]).optional(),
  status: z
    .enum(["PENDING_VERIFICATION", "ACTIVE", "SUSPENDED", "DEACTIVATED"])
    .optional(),
  query: z.string().max(255).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type SearchAgentsInput = z.infer<typeof SearchAgentsSchema>;
