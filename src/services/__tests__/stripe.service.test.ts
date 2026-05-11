import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: { sessions: { create: vi.fn() } },
    transfers: { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    payoutRequest: { findUnique: vi.fn() },
    wallet: { upsert: vi.fn() },
  },
}));

import {
  createCheckoutSession,
  processAchPayout,
} from "@/services/stripe.service";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

const mockWalletUpsert = prisma.wallet.upsert as ReturnType<typeof vi.fn>;
const mockCheckoutCreate = stripe.checkout.sessions.create as ReturnType<
  typeof vi.fn
>;
const mockPayoutFindUnique = prisma.payoutRequest.findUnique as ReturnType<
  typeof vi.fn
>;
const mockTransferCreate = stripe.transfers.create as ReturnType<typeof vi.fn>;

describe("stripe service rail flags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ENABLE_STRIPE_DEPOSITS;
    delete process.env.ENABLE_STRIPE_WITHDRAWALS;
  });

  it("rejects advertiser Stripe deposits when the rail is disabled", async () => {
    await expect(
      createCheckoutSession("agent-1", 1000, "card")
    ).rejects.toThrow("Card and bank deposits are not currently available");

    expect(mockWalletUpsert).not.toHaveBeenCalled();
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });

  it("rejects affiliate Stripe withdrawals when the rail is disabled", async () => {
    await expect(processAchPayout("payout-1")).rejects.toThrow(
      "Bank withdrawals are not currently available"
    );

    expect(mockPayoutFindUnique).not.toHaveBeenCalled();
    expect(mockTransferCreate).not.toHaveBeenCalled();
  });
});
