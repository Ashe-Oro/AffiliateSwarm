import { z } from "zod";

export const RegisterWebhookSchema = z.object({
  url: z
    .string()
    .url("Invalid webhook URL")
    .max(2048, "URL must be 2048 characters or fewer"),
  events: z
    .array(z.string().min(1).max(100))
    .min(1, "At least one event type is required")
    .max(50, "Maximum 50 event types allowed"),
});

export type RegisterWebhookInput = z.infer<typeof RegisterWebhookSchema>;
