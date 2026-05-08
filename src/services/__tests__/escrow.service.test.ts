import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock external modules before importing anything that uses them
// ---------------------------------------------------------------------------

const mockTx = {
  agent: { updateMany: vi.fn() },
  campaign: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  wallet: { upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  escrowAccount: { findUnique: vi.fn(), update: vi.fn() },
  escrowHold: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  ledgerEntry: { create: vi.fn() },
  domainEvent: { create: vi.fn() },
  payoutRequest: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  conversionEvent: { create: vi.fn() },
  partner: { update: vi.fn() },
  partnerReferral: { findUnique: vi.fn() },
  partnerTransaction: { create: vi.fn() },
};

vi.mock("@/services/notification.service", () => ({
  notify: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    wallet: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    escrowAccount: {
      findUnique: vi.fn(),
    },
    escrowHold: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    payoutRequest: {
      create: vi.fn(),
    },
    ledgerEntry: {
      create: vi.fn(),
    },
    domainEvent: {
      create: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
  },
}));

// ---------------------------------------------------------------------------
// Imports (loaded after mocks)
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import {
  placeHold,
  releaseHold,
  refundHold,
  getWallet,
  requestPayout,
  calculatePayout,
  processMaturedHolds,
  cancelPayout,
  classifyFundingError,
} from "@/services/escrow.service";
import {
  ForbiddenError,
  ValidationError,
  NotFoundError,
  BudgetExhaustedError,
  WalletShortfallError,
} from "@/lib/errors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADVERTISER_ID = "550e8400-e29b-41d4-a716-446655440000";
const AFFILIATE_ID = "550e8400-e29b-41d4-a716-446655440001";
const CAMPAIGN_ID = "660e8400-e29b-41d4-a716-446655440000";
const WALLET_ID = "770e8400-e29b-41d4-a716-446655440000";
const ESCROW_ID = "880e8400-e29b-41d4-a716-446655440000";
const HOLD_ID = "990e8400-e29b-41d4-a716-446655440000";
const LEAD_ID = "aa0e8400-e29b-41d4-a716-446655440000";

function mockCampaign(overrides: Record<string, unknown> = {}) {
  return {
    id: CAMPAIGN_ID,
    advertiserId: ADVERTISER_ID,
    name: "Test Campaign",
    currency: "USD",
    status: "ACTIVE",
    deletedAt: null,
    ...overrides,
  };
}

function mockWallet(overrides: Record<string, unknown> = {}) {
  return {
    id: WALLET_ID,
    agentId: ADVERTISER_ID,
    currency: "USD",
    availableCents: 10000,
    heldCents: 0,
    pendingPayoutCents: 0,
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function mockEscrow(overrides: Record<string, unknown> = {}) {
  return {
    id: ESCROW_ID,
    campaignId: CAMPAIGN_ID,
    currency: "USD",
    totalDepositedCents: 10000,
    currentBalanceCents: 5000,
    totalReleasedCents: 3000,
    totalRefundedCents: 2000,
    ...overrides,
  };
}

function mockHold(overrides: Record<string, unknown> = {}) {
  return {
    id: HOLD_ID,
    escrowId: ESCROW_ID,
    leadId: LEAD_ID,
    affiliateId: AFFILIATE_ID,
    amountCents: 1000,
    currency: "USD",
    status: "HELD",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// placeHold
// ---------------------------------------------------------------------------

describe("placeHold", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path: creates hold and decrements escrow balance", async () => {
    const escrow = mockEscrow({ currentBalanceCents: 5000 });
    const hold = mockHold();

    mockTx.escrowAccount.findUnique.mockResolvedValue(escrow);
    mockTx.escrowAccount.update.mockResolvedValue({});
    mockTx.escrowHold.create.mockResolvedValue(hold);
    mockTx.ledgerEntry.create.mockResolvedValue({});
    mockTx.campaign.findUnique.mockResolvedValue(mockCampaign({ budgetCents: 100000 }));
    mockTx.domainEvent.create.mockResolvedValue({});

    const result = await placeHold(ESCROW_ID, LEAD_ID, AFFILIATE_ID, 1000);

    expect(result.status).toBe("HELD");
    expect(result.amountCents).toBe(1000);

    // Verify escrow balance was decremented
    expect(mockTx.escrowAccount.update).toHaveBeenCalledWith({
      where: { id: ESCROW_ID },
      data: {
        currentBalanceCents: { decrement: 1000 },
      },
    });

    // Verify hold was created
    expect(mockTx.escrowHold.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        escrowId: ESCROW_ID,
        leadId: LEAD_ID,
        affiliateId: AFFILIATE_ID,
        amountCents: 1000,
        status: "HELD",
      }),
    });

    // Verify ledger entry
    expect(mockTx.ledgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        debitAccountType: "ESCROW",
        creditAccountType: "ESCROW",
        amountCents: 1000,
        entryType: "ESCROW_HOLD",
        referenceType: "LEAD",
        referenceId: LEAD_ID,
      }),
    });
  });

  it("throws ValidationError for non-positive amount", async () => {
    await expect(
      placeHold(ESCROW_ID, LEAD_ID, AFFILIATE_ID, 0)
    ).rejects.toThrow("Hold amount must be positive");
  });

  it("throws NotFoundError when escrow not found", async () => {
    mockTx.escrowAccount.findUnique.mockResolvedValue(null);

    await expect(
      placeHold(ESCROW_ID, LEAD_ID, AFFILIATE_ID, 1000)
    ).rejects.toThrow("not found");
  });

  it("auto-funds from advertiser wallet when escrow is short", async () => {
    // Escrow has 500, needs 1000 → deficit 500. Campaign budget is 100000
    // (plenty of headroom). Wallet has 10000 → should auto-fund the deficit.
    const escrow = mockEscrow({ currentBalanceCents: 500, totalDepositedCents: 500 });
    const hold = mockHold();
    mockTx.escrowAccount.findUnique.mockResolvedValue(escrow);
    mockTx.campaign.findUnique.mockResolvedValue(
      mockCampaign({ budgetCents: 100000 })
    );
    mockTx.wallet.findUnique.mockResolvedValue(mockWallet({ availableCents: 10000 }));
    mockTx.wallet.update.mockResolvedValue({});
    mockTx.escrowAccount.update.mockResolvedValue({});
    mockTx.escrowHold.create.mockResolvedValue(hold);
    mockTx.ledgerEntry.create.mockResolvedValue({});
    mockTx.domainEvent.create.mockResolvedValue({});

    const result = await placeHold(ESCROW_ID, LEAD_ID, AFFILIATE_ID, 1000);

    expect(result.status).toBe("HELD");

    // Wallet decremented by exactly the deficit (500)
    expect(mockTx.wallet.update).toHaveBeenCalledWith({
      where: { id: WALLET_ID },
      data: { availableCents: { decrement: 500 } },
    });

    // Escrow topped up by the deficit before the hold is placed
    expect(mockTx.escrowAccount.update).toHaveBeenCalledWith({
      where: { id: ESCROW_ID },
      data: {
        totalDepositedCents: { increment: 500 },
        currentBalanceCents: { increment: 500 },
      },
    });

    // Deposit-type ledger entry for the auto-fund
    expect(mockTx.ledgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entryType: "DEPOSIT",
          debitAccountType: "WALLET",
          creditAccountType: "ESCROW",
          amountCents: 500,
        }),
      })
    );
  });

  it("rejects when the auto-fund would exceed the campaign budget cap", async () => {
    // Escrow has 500, needs 1000 → deficit 500. Campaign budget is 600,
    // totalDeposited is 500 → only 100 headroom left. Must reject.
    const escrow = mockEscrow({ currentBalanceCents: 500, totalDepositedCents: 500 });
    mockTx.escrowAccount.findUnique.mockResolvedValue(escrow);
    mockTx.campaign.findUnique.mockResolvedValue(
      mockCampaign({ budgetCents: 600 })
    );

    await expect(
      placeHold(ESCROW_ID, LEAD_ID, AFFILIATE_ID, 1000)
    ).rejects.toMatchObject({
      name: "BudgetExhaustedError",
      code: "CAMPAIGN_BUDGET_EXHAUSTED",
      statusCode: 400,
      message: "Campaign budget exhausted",
      details: undefined,
      fundingContext: {
        deficitCents: 500,
        headroomCents: 100,
        budgetCents: 600,
      },
    });
  });

  it("rejects when the advertiser wallet can't cover the deficit", async () => {
    const escrow = mockEscrow({ currentBalanceCents: 500, totalDepositedCents: 500 });
    mockTx.escrowAccount.findUnique.mockResolvedValue(escrow);
    mockTx.campaign.findUnique.mockResolvedValue(
      mockCampaign({ budgetCents: 100000 })
    );
    mockTx.wallet.findUnique.mockResolvedValue(mockWallet({ availableCents: 100 }));

    await expect(
      placeHold(ESCROW_ID, LEAD_ID, AFFILIATE_ID, 1000)
    ).rejects.toMatchObject({
      name: "WalletShortfallError",
      code: "ADVERTISER_WALLET_INSUFFICIENT_BALANCE",
      statusCode: 400,
      message: "Insufficient advertiser wallet balance",
      details: undefined,
      fundingContext: {
        deficitCents: 500,
        walletAvailableCents: 100,
      },
    });
  });
});

// ---------------------------------------------------------------------------
// 3. releaseHold
// ---------------------------------------------------------------------------

describe("releaseHold", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path: updates hold to RELEASED, credits affiliate wallet, creates ledger entry", async () => {
    const hold = mockHold({ escrowAccount: { campaignId: CAMPAIGN_ID } });
    const updatedHold = mockHold({ status: "RELEASED", releasedAt: new Date() });
    const affiliateWallet = mockWallet({ id: "aff-wallet-id", agentId: AFFILIATE_ID });

    mockTx.escrowHold.findUnique.mockResolvedValue(hold);
    mockTx.escrowHold.update.mockResolvedValue(updatedHold);
    mockTx.escrowAccount.update.mockResolvedValue({});
    mockTx.wallet.upsert.mockResolvedValue(affiliateWallet);
    mockTx.wallet.findUnique.mockResolvedValue(affiliateWallet);
    mockTx.ledgerEntry.create.mockResolvedValue({});
    mockTx.domainEvent.create.mockResolvedValue({});
    mockTx.campaign.findUnique.mockResolvedValue(mockCampaign({ holdingPeriodDays: 0 }));

    const result = await releaseHold(HOLD_ID);

    expect(result.status).toBe("RELEASED");

    // Verify hold was updated
    expect(mockTx.escrowHold.update).toHaveBeenCalledWith({
      where: { id: HOLD_ID },
      data: {
        status: "RELEASED",
        releasedAt: expect.any(Date),
      },
    });

    // Verify escrow totalReleasedCents was incremented
    expect(mockTx.escrowAccount.update).toHaveBeenCalledWith({
      where: { id: ESCROW_ID },
      data: {
        totalReleasedCents: { increment: 1000 },
      },
    });

    // Verify affiliate wallet was credited hold amount minus 5% platform fee
    // $10.00 hold - $0.50 fee = $9.50 to affiliate
    expect(mockTx.wallet.upsert).toHaveBeenCalledWith({
      where: { agentId: AFFILIATE_ID },
      create: expect.objectContaining({
        agentId: AFFILIATE_ID,
        availableCents: 950,
      }),
      update: {
        availableCents: { increment: 950 },
      },
    });

    // Verify ledger entry — net payout to affiliate
    expect(mockTx.ledgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        debitAccountType: "ESCROW",
        creditAccountType: "WALLET",
        creditAccountId: "aff-wallet-id",
        amountCents: 950,
        entryType: "ESCROW_RELEASE",
      }),
    });

    // Verify platform fee ledger entry
    expect(mockTx.ledgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        debitAccountType: "ESCROW",
        creditAccountType: "PLATFORM_REVENUE",
        amountCents: 50,
        entryType: "FEE",
      }),
    });

    // Verify domain event
    expect(mockTx.domainEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        aggregateType: "EscrowHold",
        eventType: "EscrowReleased",
      }),
    });
  });

  it("throws NotFoundError when hold not found", async () => {
    mockTx.escrowHold.findUnique.mockResolvedValue(null);

    await expect(releaseHold(HOLD_ID)).rejects.toThrow("not found");
  });

  it("throws ValidationError when hold is not in HELD status", async () => {
    const hold = mockHold({ status: "RELEASED" });
    mockTx.escrowHold.findUnique.mockResolvedValue(hold);

    await expect(releaseHold(HOLD_ID)).rejects.toThrow(
      "Hold cannot be released from status"
    );
  });

  it("throws ValidationError when hold is already REFUNDED", async () => {
    const hold = mockHold({ status: "REFUNDED" });
    mockTx.escrowHold.findUnique.mockResolvedValue(hold);

    await expect(releaseHold(HOLD_ID)).rejects.toThrow(
      "Hold cannot be released from status 'REFUNDED'"
    );
  });
});

// ---------------------------------------------------------------------------
// 4. refundHold
// ---------------------------------------------------------------------------

describe("refundHold", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path: updates hold to REFUNDED and returns funds to escrow", async () => {
    const hold = mockHold();
    const updatedHold = mockHold({ status: "REFUNDED", refundedAt: new Date() });

    mockTx.escrowHold.findUnique.mockResolvedValue(hold);
    mockTx.escrowHold.update.mockResolvedValue(updatedHold);
    mockTx.escrowAccount.update.mockResolvedValue({});
    mockTx.ledgerEntry.create.mockResolvedValue({});
    mockTx.domainEvent.create.mockResolvedValue({});

    const result = await refundHold(HOLD_ID);

    expect(result.status).toBe("REFUNDED");

    // Verify hold was updated
    expect(mockTx.escrowHold.update).toHaveBeenCalledWith({
      where: { id: HOLD_ID },
      data: {
        status: "REFUNDED",
        refundedAt: expect.any(Date),
      },
    });

    // Verify funds returned to escrow
    expect(mockTx.escrowAccount.update).toHaveBeenCalledWith({
      where: { id: ESCROW_ID },
      data: {
        currentBalanceCents: { increment: 1000 },
        totalRefundedCents: { increment: 1000 },
      },
    });

    // Verify ledger entry
    expect(mockTx.ledgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        debitAccountType: "ESCROW",
        debitAccountId: HOLD_ID,
        creditAccountType: "ESCROW",
        creditAccountId: ESCROW_ID,
        amountCents: 1000,
        entryType: "REFUND",
      }),
    });

    // Verify domain event
    expect(mockTx.domainEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        aggregateType: "EscrowHold",
        eventType: "EscrowRefunded",
      }),
    });
  });

  it("throws NotFoundError when hold not found", async () => {
    mockTx.escrowHold.findUnique.mockResolvedValue(null);

    await expect(refundHold(HOLD_ID)).rejects.toThrow("not found");
  });

  it("refunds a PENDING_RELEASE hold and reverses budget/release totals", async () => {
    const hold = mockHold({
      status: "PENDING_RELEASE",
      escrowAccount: { campaignId: CAMPAIGN_ID },
    });
    const updatedHold = mockHold({ status: "REFUNDED", refundedAt: new Date() });

    mockTx.escrowHold.findUnique.mockResolvedValue(hold);
    mockTx.escrowHold.update.mockResolvedValue(updatedHold);
    mockTx.escrowAccount.update.mockResolvedValue({});
    mockTx.campaign.update.mockResolvedValue({});
    mockTx.ledgerEntry.create.mockResolvedValue({});
    mockTx.domainEvent.create.mockResolvedValue({});

    const result = await refundHold(HOLD_ID);

    expect(result.status).toBe("REFUNDED");

    // Verify funds returned to escrow with totalReleasedCents decremented
    expect(mockTx.escrowAccount.update).toHaveBeenCalledWith({
      where: { id: ESCROW_ID },
      data: {
        currentBalanceCents: { increment: 1000 },
        totalRefundedCents: { increment: 1000 },
        totalReleasedCents: { decrement: 1000 },
      },
    });

    // Verify budgetSpentCents was decremented
    expect(mockTx.campaign.update).toHaveBeenCalledWith({
      where: { id: CAMPAIGN_ID },
      data: {
        budgetSpentCents: { decrement: 1000 },
      },
    });

    // Verify ledger entry uses ADJUSTMENT type for disputes
    expect(mockTx.ledgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entryType: "ADJUSTMENT",
      }),
    });
  });

  it("throws ValidationError when hold is in RELEASED status", async () => {
    const hold = mockHold({ status: "RELEASED" });
    mockTx.escrowHold.findUnique.mockResolvedValue(hold);

    await expect(refundHold(HOLD_ID)).rejects.toThrow(
      "Hold cannot be refunded from status 'RELEASED'"
    );
  });

  it("throws ValidationError when hold is already REFUNDED", async () => {
    const hold = mockHold({ status: "REFUNDED" });
    mockTx.escrowHold.findUnique.mockResolvedValue(hold);

    await expect(refundHold(HOLD_ID)).rejects.toThrow(
      "Hold cannot be refunded from status 'REFUNDED'"
    );
  });
});

// ---------------------------------------------------------------------------
// 5. getWallet
// ---------------------------------------------------------------------------

describe("getWallet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns wallet with computed totalCents and pending release info", async () => {
    const wallet = mockWallet({
      availableCents: 5000,
      heldCents: 2000,
      pendingPayoutCents: 1000,
    });
    const releaseDate = new Date("2099-05-08T00:00:00Z");
    (prisma.wallet.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(wallet);
    (prisma.escrowHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.escrowHold.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _sum: { amountCents: 1500 },
      _min: { releaseAt: releaseDate },
    });

    const result = await getWallet(ADVERTISER_ID);

    expect(result.availableCents).toBe(5000);
    expect(result.heldCents).toBe(2000);
    expect(result.pendingPayoutCents).toBe(1000);
    expect(result.totalCents).toBe(8000);
    expect(result.status).toBe("ACTIVE");
    expect(result.pendingReleaseCents).toBe(1500);
    expect(result.nextReleaseAt).toEqual(releaseDate);
  });

  it("throws NotFoundError when wallet not found", async () => {
    (prisma.wallet.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.escrowHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.escrowHold.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _sum: { amountCents: null },
      _min: { releaseAt: null },
    });

    await expect(getWallet(ADVERTISER_ID)).rejects.toThrow("not found");
  });

  it("returns zero pending release when no holds exist", async () => {
    const wallet = mockWallet({
      availableCents: 0,
      heldCents: 0,
      pendingPayoutCents: 0,
    });
    (prisma.wallet.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(wallet);
    (prisma.escrowHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.escrowHold.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _sum: { amountCents: null },
      _min: { releaseAt: null },
    });

    const result = await getWallet(ADVERTISER_ID);
    expect(result.totalCents).toBe(0);
    expect(result.pendingReleaseCents).toBe(0);
    expect(result.nextReleaseAt).toBeNull();
  });

  // Regression tests for #222 — clock-authoritative availableCents.
  // Matured PENDING_RELEASE holds should count as available immediately,
  // without waiting for processMaturedHolds() cron to flip their status.
  it("counts matured PENDING_RELEASE holds as available, net of platform fee", async () => {
    const wallet = mockWallet({
      availableCents: 0,
      heldCents: 0,
      pendingPayoutCents: 0,
    });
    // Three $10 matured holds, mirroring the exact scenario from issue #222.
    // Default PLATFORM_FEE_RATE = 0.05 → fee = ceil(1000 * 0.05) = 50 per hold.
    // Net per hold = 950. Total = 2850.
    (prisma.wallet.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(wallet);
    (prisma.escrowHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { amountCents: 1000 },
      { amountCents: 1000 },
      { amountCents: 1000 },
    ]);
    (prisma.escrowHold.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _sum: { amountCents: null },
      _min: { releaseAt: null },
    });

    const result = await getWallet(AFFILIATE_ID);

    expect(result.availableCents).toBe(2850);
    expect(result.pendingReleaseCents).toBe(0);
    expect(result.nextReleaseAt).toBeNull();
    expect(result.totalCents).toBe(2850);
  });

  it("keeps unmatured PENDING_RELEASE holds in pendingReleaseCents and out of available", async () => {
    const wallet = mockWallet({
      availableCents: 5000,
      heldCents: 0,
      pendingPayoutCents: 0,
    });
    const future = new Date("2099-06-01T00:00:00Z");
    (prisma.wallet.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(wallet);
    (prisma.escrowHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.escrowHold.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _sum: { amountCents: 3000 },
      _min: { releaseAt: future },
    });

    const result = await getWallet(AFFILIATE_ID);

    expect(result.availableCents).toBe(5000);
    expect(result.pendingReleaseCents).toBe(3000);
    expect(result.nextReleaseAt).toEqual(future);
  });

  it("splits mixed matured and unmatured holds into the correct buckets", async () => {
    const wallet = mockWallet({
      availableCents: 10000,
      heldCents: 0,
      pendingPayoutCents: 0,
    });
    const future = new Date("2099-07-15T00:00:00Z");
    (prisma.wallet.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(wallet);
    // One $20 matured hold → net 1900 after 5% fee.
    (prisma.escrowHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { amountCents: 2000 },
    ]);
    // Two unmatured holds summing to 4000, earliest at `future`.
    (prisma.escrowHold.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _sum: { amountCents: 4000 },
      _min: { releaseAt: future },
    });

    const result = await getWallet(AFFILIATE_ID);

    expect(result.availableCents).toBe(11900);
    expect(result.pendingReleaseCents).toBe(4000);
    expect(result.nextReleaseAt).toEqual(future);
    expect(result.totalCents).toBe(11900);
  });
});

// ---------------------------------------------------------------------------
// 6. requestPayout
// ---------------------------------------------------------------------------

describe("requestPayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path: moves funds to pendingPayout and creates payout request", async () => {
    const wallet = mockWallet({ agentId: AFFILIATE_ID, availableCents: 5000 });
    const payout = {
      id: "payout-1",
      affiliateId: AFFILIATE_ID,
      walletId: WALLET_ID,
      amountCents: 3000,
      method: "CRYPTO",
      status: "PENDING",
    };

    mockTx.wallet.findUnique.mockResolvedValue(wallet);
    mockTx.wallet.update.mockResolvedValue({});
    mockTx.payoutRequest.create.mockResolvedValue(payout);
    mockTx.ledgerEntry.create.mockResolvedValue({});
    mockTx.domainEvent.create.mockResolvedValue({});

    const chainAddress = "0x1234567890abcdef1234567890abcdef12345678";
    const result = await requestPayout(AFFILIATE_ID, 3000, "CRYPTO", {
      chainAddress,
    });

    expect(result.status).toBe("PENDING");
    expect(result.amountCents).toBe(3000);

    // Verify funds were moved from available to pendingPayout
    expect(mockTx.wallet.update).toHaveBeenCalledWith({
      where: { id: WALLET_ID },
      data: {
        availableCents: { decrement: 3000 },
        pendingPayoutCents: { increment: 3000 },
      },
    });

    // Verify payout request was created
    expect(mockTx.payoutRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        affiliateId: AFFILIATE_ID,
        amountCents: 3000,
        method: "CRYPTO",
        status: "PENDING",
      }),
    });
  });

  it("throws ValidationError for non-positive amount", async () => {
    await expect(
      requestPayout(AFFILIATE_ID, 0, "CRYPTO", {
        chainAddress: "0x1234567890abcdef1234567890abcdef12345678",
      })
    ).rejects.toThrow("Payout amount must be positive");
  });

  it("throws ValidationError for insufficient available balance", async () => {
    const wallet = mockWallet({ agentId: AFFILIATE_ID, availableCents: 1000 });
    mockTx.wallet.findUnique.mockResolvedValue(wallet);

    await expect(
      requestPayout(AFFILIATE_ID, 5000, "CRYPTO", {
        chainAddress: "0x1234567890abcdef1234567890abcdef12345678",
      })
    ).rejects.toThrow("Insufficient available balance");
  });

  it("throws ValidationError for inactive wallet", async () => {
    const wallet = mockWallet({
      agentId: AFFILIATE_ID,
      availableCents: 5000,
      status: "FROZEN",
    });
    mockTx.wallet.findUnique.mockResolvedValue(wallet);

    await expect(
      requestPayout(AFFILIATE_ID, 3000, "CRYPTO", {
        chainAddress: "0x1234567890abcdef1234567890abcdef12345678",
      })
    ).rejects.toThrow("Wallet is not active");
  });

  it("throws NotFoundError when wallet not found", async () => {
    mockTx.wallet.findUnique.mockResolvedValue(null);

    await expect(
      requestPayout(AFFILIATE_ID, 3000, "CRYPTO", {
        chainAddress: "0x1234567890abcdef1234567890abcdef12345678",
      })
    ).rejects.toThrow("not found");
  });

  it("throws ValidationError for CRYPTO payout without chainAddress", async () => {
    await expect(
      requestPayout(AFFILIATE_ID, 3000, "CRYPTO", {})
    ).rejects.toThrow("valid chainAddress");
  });

  it("throws ValidationError for CRYPTO payout with invalid chainAddress", async () => {
    await expect(
      requestPayout(AFFILIATE_ID, 3000, "CRYPTO", {
        chainAddress: "not-an-address",
      })
    ).rejects.toThrow("valid chainAddress");
  });

  it("accepts BANK_TRANSFER without chainAddress", async () => {
    const wallet = mockWallet({ agentId: AFFILIATE_ID, availableCents: 5000 });
    const payout = {
      id: "payout-2",
      affiliateId: AFFILIATE_ID,
      walletId: WALLET_ID,
      amountCents: 2000,
      method: "BANK_TRANSFER",
      status: "PENDING",
    };

    mockTx.wallet.findUnique.mockResolvedValue(wallet);
    mockTx.wallet.update.mockResolvedValue({});
    mockTx.payoutRequest.create.mockResolvedValue(payout);
    mockTx.ledgerEntry.create.mockResolvedValue({});
    mockTx.domainEvent.create.mockResolvedValue({});

    const result = await requestPayout(AFFILIATE_ID, 2000, "BANK_TRANSFER", {
      routingNumber: "123456",
      accountNumber: "789012",
    });

    expect(result.status).toBe("PENDING");
  });
});

// ---------------------------------------------------------------------------
// 7. calculatePayout
// ---------------------------------------------------------------------------

describe("calculatePayout", () => {
  it("CPL: returns campaign payoutPerUnitCents", () => {
    const result = calculatePayout({
      compensationModel: "CPL",
      payoutPerUnitCents: 500,
      payoutPercentage: null,
    });
    expect(result).toBe(500);
  });

  it("CPA: returns campaign payoutPerUnitCents", () => {
    const result = calculatePayout({
      compensationModel: "CPA",
      payoutPerUnitCents: 2000,
      payoutPercentage: null,
    });
    expect(result).toBe(2000);
  });

  it("CPC: returns fixed amount per click", () => {
    const result = calculatePayout({
      compensationModel: "CPC",
      payoutPerUnitCents: 10,
      payoutPercentage: null,
    });
    expect(result).toBe(10);
  });

  it("lockedPayoutCents takes precedence when provided", () => {
    const result = calculatePayout(
      {
        compensationModel: "CPA",
        payoutPerUnitCents: 2000,
        payoutPercentage: null,
      },
      { lockedPayoutCents: 1500 }
    );
    expect(result).toBe(1500);
  });

  it("REV_SHARE: computes revenueCents * payoutPercentage / 100, rounded", () => {
    // 1499 cents revenue * 20% = 299.8 → rounds to 300 cents ($3.00)
    const result = calculatePayout(
      {
        compensationModel: "REV_SHARE",
        payoutPerUnitCents: null,
        payoutPercentage: 20,
      },
      { revenueCents: 1499 }
    );
    expect(result).toBe(300);
  });

  it("REV_SHARE: 1% is the minimum, rounds correctly", () => {
    // 9950 cents * 1% = 99.5 → rounds to 100
    const result = calculatePayout(
      {
        compensationModel: "REV_SHARE",
        payoutPerUnitCents: null,
        payoutPercentage: 1,
      },
      { revenueCents: 9950 }
    );
    expect(result).toBe(100);
  });

  it("REV_SHARE: 100% returns full revenue", () => {
    const result = calculatePayout(
      {
        compensationModel: "REV_SHARE",
        payoutPerUnitCents: null,
        payoutPercentage: 100,
      },
      { revenueCents: 5000 }
    );
    expect(result).toBe(5000);
  });

  it("REV_SHARE: throws when revenueCents is missing", () => {
    expect(() =>
      calculatePayout({
        compensationModel: "REV_SHARE",
        payoutPerUnitCents: null,
        payoutPercentage: 20,
      })
    ).toThrow(/revenueCents/);
  });

  it("REV_SHARE: throws when payoutPercentage is missing", () => {
    expect(() =>
      calculatePayout(
        {
          compensationModel: "REV_SHARE",
          payoutPerUnitCents: null,
          payoutPercentage: null,
        },
        { revenueCents: 1000 }
      )
    ).toThrow(/payoutPercentage/);
  });

  it("CPL/CPA/CPC: throws when payoutPerUnitCents is missing", () => {
    expect(() =>
      calculatePayout({
        compensationModel: "CPL",
        payoutPerUnitCents: null,
        payoutPercentage: null,
      })
    ).toThrow(/payoutPerUnitCents/);
  });
});

// ---------------------------------------------------------------------------
// 9. processMaturedHolds
// ---------------------------------------------------------------------------

describe("processMaturedHolds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("processes matured holds: transitions to RELEASED and credits wallet", async () => {
    const maturedHold = mockHold({
      status: "PENDING_RELEASE",
      releaseAt: new Date("2026-04-10T00:00:00Z"),
    });

    (prisma.escrowHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([maturedHold]);

    // Transaction mocks: re-fetch hold, update, finalize release
    mockTx.escrowHold.findUnique.mockResolvedValue(maturedHold);
    mockTx.escrowHold.update.mockResolvedValue({ ...maturedHold, status: "RELEASED" });
    mockTx.escrowAccount.findUnique.mockResolvedValue({
      campaignId: CAMPAIGN_ID,
      advertiserId: ADVERTISER_ID,
    });
    mockTx.wallet.upsert.mockResolvedValue(mockWallet({ availableCents: 1000 }));
    mockTx.wallet.findUnique.mockResolvedValue(mockWallet());
    mockTx.ledgerEntry.create.mockResolvedValue({});
    mockTx.domainEvent.create.mockResolvedValue({});
    mockTx.partnerReferral.findUnique.mockResolvedValue(null);

    // Post-transaction: escrow lookup for notification
    (prisma.escrowAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      campaignId: CAMPAIGN_ID,
      campaign: { name: "Test Campaign" },
    });

    const results = await processMaturedHolds();

    expect(results.processed).toBe(1);
    expect(results.failed).toBe(0);

    // Verify hold was updated to RELEASED
    expect(mockTx.escrowHold.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: HOLD_ID },
        data: expect.objectContaining({ status: "RELEASED" }),
      })
    );

    // Verify wallet was credited (net of 5% fee: 1000 - 50 = 950)
    expect(mockTx.wallet.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { agentId: AFFILIATE_ID },
        update: { availableCents: { increment: 950 } },
      })
    );
  });

  it("returns zero when no matured holds exist", async () => {
    (prisma.escrowHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const results = await processMaturedHolds();

    expect(results.processed).toBe(0);
    expect(results.failed).toBe(0);
  });

  it("counts failures without throwing", async () => {
    const maturedHold = mockHold({
      status: "PENDING_RELEASE",
      releaseAt: new Date("2026-04-10T00:00:00Z"),
    });

    (prisma.escrowHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([maturedHold]);

    // Transaction throws
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("DB error")
    );

    const results = await processMaturedHolds();

    expect(results.processed).toBe(0);
    expect(results.failed).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// cancelPayout
// ---------------------------------------------------------------------------

describe("cancelPayout", () => {
  const PAYOUT_ID = "bb0e8400-e29b-41d4-a716-446655440000";

  function mockPayout(overrides: Record<string, unknown> = {}) {
    return {
      id: PAYOUT_ID,
      affiliateId: AFFILIATE_ID,
      walletId: WALLET_ID,
      amountCents: 500,
      currency: "USD",
      method: "CRYPTO",
      status: "PENDING",
      failureReason: null,
      requestedAt: new Date(),
      processedAt: null,
      completedAt: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cancels a PENDING payout and refunds the funds", async () => {
    mockTx.payoutRequest.findUnique.mockResolvedValue(mockPayout());
    mockTx.wallet.update.mockResolvedValue({});
    mockTx.payoutRequest.update.mockResolvedValue(
      mockPayout({ status: "CANCELLED", processedAt: new Date() })
    );
    mockTx.ledgerEntry.create.mockResolvedValue({});

    const result = await cancelPayout(PAYOUT_ID, AFFILIATE_ID);

    expect(result.status).toBe("CANCELLED");

    // Funds moved from pendingPayout back to available
    expect(mockTx.wallet.update).toHaveBeenCalledWith({
      where: { id: WALLET_ID },
      data: {
        availableCents: { increment: 500 },
        pendingPayoutCents: { decrement: 500 },
      },
    });

    // Payout marked CANCELLED (not FAILED)
    expect(mockTx.payoutRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PAYOUT_ID },
        data: expect.objectContaining({
          status: "CANCELLED",
          processedAt: expect.any(Date),
        }),
      })
    );

    // Reversing ledger entry recorded
    expect(mockTx.ledgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entryType: "REFUND",
          creditAccountType: "WALLET",
          creditAccountId: WALLET_ID,
          amountCents: 500,
        }),
      })
    );
  });

  it("throws NotFoundError for a missing payout", async () => {
    mockTx.payoutRequest.findUnique.mockResolvedValue(null);

    await expect(cancelPayout(PAYOUT_ID, AFFILIATE_ID)).rejects.toThrow(
      NotFoundError
    );
  });

  it("rejects when another agent tries to cancel someone else's payout", async () => {
    mockTx.payoutRequest.findUnique.mockResolvedValue(
      mockPayout({ affiliateId: "other-agent" })
    );

    await expect(cancelPayout(PAYOUT_ID, AFFILIATE_ID)).rejects.toThrow(
      ForbiddenError
    );
  });

  it("rejects when the payout is already PROCESSING", async () => {
    mockTx.payoutRequest.findUnique.mockResolvedValue(
      mockPayout({ status: "PROCESSING" })
    );

    await expect(cancelPayout(PAYOUT_ID, AFFILIATE_ID)).rejects.toThrow(
      ValidationError
    );
  });

  it("rejects when the payout is already COMPLETED", async () => {
    mockTx.payoutRequest.findUnique.mockResolvedValue(
      mockPayout({ status: "COMPLETED" })
    );

    await expect(cancelPayout(PAYOUT_ID, AFFILIATE_ID)).rejects.toThrow(
      ValidationError
    );
  });
});

// ---------------------------------------------------------------------------
// classifyFundingError
// ---------------------------------------------------------------------------

describe("classifyFundingError", () => {
  it("classifies WalletShortfallError as wallet_empty", () => {
    const err = new WalletShortfallError({
      deficitCents: 500,
      walletAvailableCents: 100,
    });
    expect(classifyFundingError(err)).toBe("wallet_empty");
  });

  it("classifies BudgetExhaustedError as budget_exhausted", () => {
    const err = new BudgetExhaustedError({
      deficitCents: 500,
      headroomCents: 100,
      budgetCents: 600,
    });
    expect(classifyFundingError(err)).toBe("budget_exhausted");
  });

  it("returns null for unrelated ValidationError", () => {
    expect(classifyFundingError(new ValidationError("something else"))).toBeNull();
  });

  it("returns null for non-ValidationError", () => {
    expect(classifyFundingError(new NotFoundError("X", "y"))).toBeNull();
    expect(classifyFundingError(new Error("plain"))).toBeNull();
    expect(classifyFundingError(null)).toBeNull();
  });
});
