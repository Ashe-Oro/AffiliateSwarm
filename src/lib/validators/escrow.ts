import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

// BANK_TRANSFER exists in the Prisma enum for historical rows but is disabled
// at the API surface — we have no Stripe Connect onboarding for affiliates, so
// we can't route ACH payouts. Only CRYPTO and PLATFORM_CREDIT are accepted.
const PayoutMethodEnum = z.enum(["CRYPTO", "PLATFORM_CREDIT"]);

const PayoutStatusEnum = z.enum([
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
]);

const LedgerEntryTypeEnum = z.enum([
  "DEPOSIT",
  "ESCROW_HOLD",
  "ESCROW_RELEASE",
  "PAYOUT",
  "REFUND",
  "FEE",
  "ADJUSTMENT",
  "CHAIN_DEPOSIT",
  "CHAIN_PAYOUT",
  "STRIPE_DEPOSIT",
]);

// ---------------------------------------------------------------------------
// Request Payout
// ---------------------------------------------------------------------------

export const RequestPayoutSchema = z
  .object({
    amountCents: z.number().int().min(100, "Minimum payout is 100 cents ($1.00)"),
    method: PayoutMethodEnum,
    destination: z.record(z.string(), z.unknown()),
  })
  .refine(
    (data) => {
      if (data.method === "CRYPTO") {
        const addr = data.destination?.chainAddress;
        return typeof addr === "string" && /^0x[0-9a-fA-F]{40}$/.test(addr);
      }
      return true;
    },
    {
      message: "CRYPTO payouts require a valid 0x chainAddress in destination",
      path: ["destination"],
    }
  );

export type RequestPayoutInput = z.infer<typeof RequestPayoutSchema>;

// ---------------------------------------------------------------------------
// List Transactions
// ---------------------------------------------------------------------------

export const ListTransactionsSchema = z.object({
  entryType: LedgerEntryTypeEnum.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListTransactionsInput = z.infer<typeof ListTransactionsSchema>;

// ---------------------------------------------------------------------------
// List Payouts
// ---------------------------------------------------------------------------

export const ListPayoutsSchema = z.object({
  status: PayoutStatusEnum.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListPayoutsInput = z.infer<typeof ListPayoutsSchema>;
