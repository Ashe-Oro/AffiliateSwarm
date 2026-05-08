import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

const NotificationCategoryEnum = z.enum([
  "CAMPAIGNS",
  "APPLICATIONS",
  "LEADS",
  "TRACKING",
  "EARNINGS",
  "PAYOUTS",
]);

// ---------------------------------------------------------------------------
// List Notifications
// ---------------------------------------------------------------------------

export const ListNotificationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  read: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  category: NotificationCategoryEnum.optional(),
  eventType: z.string().max(100).optional(),
});

export type ListNotificationsInput = z.infer<typeof ListNotificationsSchema>;

// ---------------------------------------------------------------------------
// Mark Read
// ---------------------------------------------------------------------------

export const MarkReadSchema = z.object({
  read: z.literal(true),
});

// ---------------------------------------------------------------------------
// Mark All Read
// ---------------------------------------------------------------------------

export const MarkAllReadSchema = z
  .object({
    before: z.coerce.date().optional(),
  })
  .optional()
  .default({});
