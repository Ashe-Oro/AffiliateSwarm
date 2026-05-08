import { z } from "zod";

export const CreateStripeCheckoutSchema = z.object({
  amountCents: z
    .number()
    .int()
    .min(1000, "Minimum deposit is $10.00"),
  paymentMethod: z.enum(["card", "ach"]),
});

export type CreateStripeCheckoutInput = z.infer<
  typeof CreateStripeCheckoutSchema
>;
