import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTx = {
  chainTransaction: { create: vi.fn() },
  wallet: { update: vi.fn() },
  ledgerEntry: { create: vi.fn() },
};

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
  isUserOperationFailedError: vi.fn(),
  transferUsdc: vi.fn(),
  centsToUsdc: vi.fn(),
  usdcToCents: vi.fn(),
}));

vi.mock("@/lib/chain/deposit-verifier", () => ({
  verifyDeposit: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    wallet: { findUnique: vi.fn() },
    chainTransaction: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { verifyDeposit } from "@/lib/chain/deposit-verifier";
import { notify } from "@/services/notification.service";
import { processOnchainDeposit } from "@/services/chain.service";

const mockFindUniqueCT = prisma.chainTransaction.findUnique as ReturnType<
  typeof vi.fn
>;
const mockFindUniqueWallet = prisma.wallet.findUnique as ReturnType<
  typeof vi.fn
>;
const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>;
const mockVerify = verifyDeposit as ReturnType<typeof vi.fn>;
const mockNotify = notify as ReturnType<typeof vi.fn>;

const VALID_TX = "0x" + "a".repeat(64);

function setupHappyPath() {
  mockFindUniqueCT.mockResolvedValue(null);
  mockFindUniqueWallet.mockResolvedValue({
    id: "wallet-1",
    agentId: "agent-1",
    depositAddress: "0x" + "b".repeat(40),
    availableCents: 0,
  });
  mockVerify.mockResolvedValue({
    verified: true,
    amountCents: 5000,
    amountUsdc: "50",
    fromAddress: "0x" + "c".repeat(40),
    toAddress: "0x" + "b".repeat(40),
    blockNumber: 123,
  });
  mockTransaction.mockImplementation(
    async (fn: (tx: typeof mockTx) => Promise<unknown>) => {
      mockTx.chainTransaction.create.mockResolvedValue({
        id: "ct-1",
        txHash: VALID_TX,
        status: "CONFIRMED",
        amountCents: 5000,
      });
      mockTx.wallet.update.mockResolvedValue({});
      mockTx.ledgerEntry.create.mockResolvedValue({});
      return fn(mockTx);
    }
  );
}

describe("processOnchainDeposit (wallet-first)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("credits wallet availableCents (not escrow) on a fresh deposit", async () => {
    setupHappyPath();

    const result = await processOnchainDeposit("agent-1", VALID_TX);

    expect(result.alreadyProcessed).toBe(false);
    expect(mockTx.wallet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "wallet-1" },
        data: { availableCents: { increment: 5000 } },
      })
    );
    expect(mockTx.ledgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          debitAccountType: "EXTERNAL",
          debitAccountId: null,
          creditAccountType: "WALLET",
          creditAccountId: "wallet-1",
          entryType: "CHAIN_DEPOSIT",
        }),
      })
    );
  });

  it("emits a wallet-oriented deposit.confirmed event", async () => {
    setupHappyPath();

    await processOnchainDeposit("agent-1", VALID_TX);

    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "deposit.confirmed",
        data: expect.objectContaining({
          agentId: "agent-1",
          walletId: "wallet-1",
          amountCents: 5000,
          txHash: VALID_TX,
        }),
      })
    );
    const call = mockNotify.mock.calls[0][0];
    expect(call.data).not.toHaveProperty("campaignId");
  });

  it("returns alreadyProcessed=true on fast-path idempotency hit", async () => {
    mockFindUniqueCT.mockResolvedValue({ id: "ct-existing", txHash: VALID_TX });

    const result = await processOnchainDeposit("agent-1", VALID_TX);

    expect(result.alreadyProcessed).toBe(true);
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("returns alreadyProcessed=true when a race hits the unique constraint", async () => {
    mockFindUniqueCT
      .mockResolvedValueOnce(null) // fast-path miss
      .mockResolvedValueOnce({ id: "ct-raced", txHash: VALID_TX }); // lookup after P2002
    mockFindUniqueWallet.mockResolvedValue({
      id: "wallet-1",
      agentId: "agent-1",
      depositAddress: "0x" + "b".repeat(40),
      availableCents: 0,
    });
    mockVerify.mockResolvedValue({
      verified: true,
      amountCents: 5000,
      amountUsdc: "50",
      fromAddress: "0x" + "c".repeat(40),
      toAddress: "0x" + "b".repeat(40),
      blockNumber: 123,
    });
    mockTransaction.mockRejectedValue(
      Object.assign(new Error("unique"), { code: "P2002" })
    );

    const result = await processOnchainDeposit("agent-1", VALID_TX);

    expect(result.alreadyProcessed).toBe(true);
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("rejects when verification fails and writes nothing", async () => {
    mockFindUniqueCT.mockResolvedValue(null);
    mockFindUniqueWallet.mockResolvedValue({
      id: "wallet-1",
      agentId: "agent-1",
      depositAddress: "0x" + "b".repeat(40),
      availableCents: 0,
    });
    mockVerify.mockResolvedValue({ verified: false });

    await expect(processOnchainDeposit("agent-1", VALID_TX)).rejects.toThrow(
      /could not be verified/
    );
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("rejects when the wallet has no deposit address", async () => {
    mockFindUniqueCT.mockResolvedValue(null);
    mockFindUniqueWallet.mockResolvedValue({
      id: "wallet-1",
      agentId: "agent-1",
      depositAddress: null,
      availableCents: 0,
    });

    await expect(processOnchainDeposit("agent-1", VALID_TX)).rejects.toThrow(
      /Initialize the wallet first/
    );
    expect(mockVerify).not.toHaveBeenCalled();
  });
});
