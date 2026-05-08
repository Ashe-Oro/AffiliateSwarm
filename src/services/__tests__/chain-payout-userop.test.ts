import { describe, it, expect, vi, beforeEach } from "vitest";

class MockUserOperationFailedError extends Error {
  constructor(
    message: string,
    public readonly userOpHash: `0x${string}`
  ) {
    super(message);
    this.name = "UserOperationFailedError";
  }
}

vi.mock("@/services/notification.service", () => ({
  notify: vi.fn(),
}));

vi.mock("@/lib/chain/wallet", () => ({
  getOrCreateAgentAccount: vi.fn(),
  nextDerivationIndex: vi.fn(),
  getPlatformAccount: vi.fn(),
}));

vi.mock("@/lib/chain/usdc", () => ({
  getUsdcBalance: vi.fn(),
  submitUsdcTransfer: vi.fn(),
  waitForUsdcTransfer: vi.fn(),
  isUserOperationFailedError: (err: unknown) =>
    err instanceof Error && err.name === "UserOperationFailedError",
  centsToUsdc: vi.fn(),
  usdcToCents: vi.fn(),
}));

vi.mock("@/lib/chain/config", () => ({
  getPublicClient: vi.fn(),
}));

vi.mock("@/lib/chain/deposit-verifier", () => ({
  verifyDeposit: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    payoutRequest: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    chainTransaction: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    wallet: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    ledgerEntry: { create: vi.fn() },
    domainEvent: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { getPlatformAccount } from "@/lib/chain/wallet";
import {
  centsToUsdc,
  submitUsdcTransfer,
  waitForUsdcTransfer,
} from "@/lib/chain/usdc";
import { getPublicClient } from "@/lib/chain/config";
import { recoverStuckPayout, sendPayout } from "@/services/chain.service";

const mockPayoutFindUnique = prisma.payoutRequest.findUnique as ReturnType<
  typeof vi.fn
>;
const mockPayoutUpdateMany = prisma.payoutRequest.updateMany as ReturnType<
  typeof vi.fn
>;
const mockPayoutUpdate = prisma.payoutRequest.update as ReturnType<
  typeof vi.fn
>;
const mockChainCreate = prisma.chainTransaction.create as ReturnType<
  typeof vi.fn
>;
const mockChainUpdate = prisma.chainTransaction.update as ReturnType<
  typeof vi.fn
>;
const mockWalletUpdate = prisma.wallet.update as ReturnType<typeof vi.fn>;
const mockLedgerCreate = prisma.ledgerEntry.create as ReturnType<typeof vi.fn>;
const mockDomainCreate = prisma.domainEvent.create as ReturnType<typeof vi.fn>;
const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>;
const mockGetPlatformAccount = getPlatformAccount as ReturnType<typeof vi.fn>;
const mockCentsToUsdc = centsToUsdc as ReturnType<typeof vi.fn>;
const mockSubmitUsdcTransfer = submitUsdcTransfer as ReturnType<typeof vi.fn>;
const mockWaitForUsdcTransfer = waitForUsdcTransfer as ReturnType<typeof vi.fn>;
const mockGetPublicClient = getPublicClient as ReturnType<typeof vi.fn>;

const PLATFORM = {
  address: "0x" + "1".repeat(40),
  name: "platform-hot",
  smartAccount: {},
};
const DESTINATION = "0x" + "2".repeat(40);
const USER_OP_HASH = ("0x" + "3".repeat(64)) as `0x${string}`;
const TX_HASH = ("0x" + "4".repeat(64)) as `0x${string}`;

function makePayout(overrides: Record<string, unknown> = {}) {
  return {
    id: "payout-1",
    status: "PENDING",
    method: "CRYPTO",
    destination: { chainAddress: DESTINATION },
    amountCents: 1234,
    walletId: "wallet-1",
    affiliateId: "affiliate-1",
    chainTransaction: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPlatformAccount.mockResolvedValue(PLATFORM);
  mockCentsToUsdc.mockReturnValue(12_340_000n);
  mockPayoutUpdateMany.mockResolvedValue({ count: 1 });
  mockChainCreate.mockResolvedValue({ id: "chain-tx-1" });
  mockChainUpdate.mockResolvedValue({});
  mockPayoutUpdate.mockResolvedValue({});
  mockWalletUpdate.mockResolvedValue({});
  mockLedgerCreate.mockResolvedValue({});
  mockDomainCreate.mockResolvedValue({});
  mockTransaction.mockResolvedValue({});
  mockGetPublicClient.mockReturnValue({
    waitForTransactionReceipt: vi.fn().mockResolvedValue({
      blockNumber: 123n,
      gasUsed: 456n,
    }),
  });
});

describe("sendPayout user operation recovery", () => {
  it("keeps a payout in PROCESSING when a submitted user op cannot be observed yet", async () => {
    mockPayoutFindUnique.mockResolvedValue(makePayout());
    mockSubmitUsdcTransfer.mockResolvedValue({ userOpHash: USER_OP_HASH });
    mockWaitForUsdcTransfer.mockRejectedValue(new Error("CDP timeout"));

    const result = await sendPayout("payout-1");

    expect(result).toMatchObject({
      success: false,
      chainTransactionId: "chain-tx-1",
      inFlight: true,
    });
    expect(mockChainCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          idempotencyKey: "payout:payout-1",
          status: "PENDING_SUBMISSION",
        }),
      })
    );
    expect(mockSubmitUsdcTransfer).toHaveBeenCalledWith(
      PLATFORM,
      DESTINATION,
      12_340_000n,
      { idempotencyKey: "payout:payout-1" }
    );
    expect(mockChainUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "chain-tx-1" },
        data: expect.objectContaining({
          status: "SUBMITTED",
          userOpHash: USER_OP_HASH,
        }),
      })
    );
    expect(mockPayoutUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      })
    );
    expect(mockWalletUpdate).not.toHaveBeenCalled();
  });

  it("refunds only when CDP reports terminal user op failure", async () => {
    mockPayoutFindUnique.mockResolvedValue(makePayout());
    mockSubmitUsdcTransfer.mockResolvedValue({ userOpHash: USER_OP_HASH });
    mockWaitForUsdcTransfer.mockRejectedValue(
      new MockUserOperationFailedError("user op failed", USER_OP_HASH)
    );

    const result = await sendPayout("payout-1");

    expect(result).toMatchObject({ success: false });
    expect(mockPayoutUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "payout-1" },
        data: expect.objectContaining({ status: "FAILED" }),
      })
    );
    expect(mockWalletUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "wallet-1" },
        data: {
          pendingPayoutCents: { decrement: 1234 },
          availableCents: { increment: 1234 },
        },
      })
    );
  });
});

describe("recoverStuckPayout user operations", () => {
  it("finalizes a submitted user op that later completed", async () => {
    mockPayoutFindUnique.mockResolvedValue(
      makePayout({
        status: "PROCESSING",
        chainTransaction: {
          id: "chain-tx-1",
          status: "SUBMITTED",
          txHash: null,
          userOpHash: USER_OP_HASH,
          fromAddress: PLATFORM.address,
          toAddress: DESTINATION,
          errorMessage: null,
        },
      })
    );
    mockWaitForUsdcTransfer.mockResolvedValue({ txHash: TX_HASH });

    const result = await recoverStuckPayout("payout-1");

    expect(result).toMatchObject({ outcome: "finalized_completed" });
    expect(mockChainUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "chain-tx-1" },
        data: expect.objectContaining({
          txHash: TX_HASH,
          status: "CONFIRMED",
        }),
      })
    );
    expect(mockWalletUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { pendingPayoutCents: { decrement: 1234 } },
      })
    );
  });

  it("leaves recovery in-flight when CDP still cannot resolve the user op", async () => {
    mockPayoutFindUnique.mockResolvedValue(
      makePayout({
        status: "PROCESSING",
        chainTransaction: {
          id: "chain-tx-1",
          status: "SUBMITTED",
          txHash: null,
          userOpHash: USER_OP_HASH,
          fromAddress: PLATFORM.address,
          toAddress: DESTINATION,
          errorMessage: null,
        },
      })
    );
    mockWaitForUsdcTransfer.mockRejectedValue(new Error("still pending"));

    const result = await recoverStuckPayout("payout-1");

    expect(result).toMatchObject({ outcome: "in_flight_skipped" });
    expect(mockChainUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "chain-tx-1" },
        data: { errorMessage: "still pending" },
      })
    );
    expect(mockPayoutUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      })
    );
    expect(mockWalletUpdate).not.toHaveBeenCalled();
  });

  it("refunds during recovery only when the stored user op failed", async () => {
    mockPayoutFindUnique.mockResolvedValue(
      makePayout({
        status: "PROCESSING",
        chainTransaction: {
          id: "chain-tx-1",
          status: "SUBMITTED",
          txHash: null,
          userOpHash: USER_OP_HASH,
          fromAddress: PLATFORM.address,
          toAddress: DESTINATION,
          errorMessage: null,
        },
      })
    );
    mockWaitForUsdcTransfer.mockRejectedValue(
      new MockUserOperationFailedError("user op failed", USER_OP_HASH)
    );

    const result = await recoverStuckPayout("payout-1");

    expect(result).toMatchObject({ outcome: "finalized_failed" });
    expect(mockChainUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "chain-tx-1" },
        data: { status: "FAILED", errorMessage: "user op failed" },
      })
    );
    expect(mockWalletUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          pendingPayoutCents: { decrement: 1234 },
          availableCents: { increment: 1234 },
        },
      })
    );
  });
});
