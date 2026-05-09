import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    wallet: { findMany: vi.fn() },
    chainTransaction: { create: vi.fn() },
  },
}));

vi.mock("../wallet", () => ({
  getPlatformAccount: vi.fn(),
  getOrCreateAgentAccount: vi.fn(),
}));

vi.mock("../usdc", () => ({
  getUsdcBalance: vi.fn(),
  transferUsdc: vi.fn(),
  usdcToCents: vi.fn(),
}));

vi.mock("../config", () => ({
  getPublicClient: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import {
  getPlatformAccount,
  getOrCreateAgentAccount,
} from "../wallet";
import { getUsdcBalance, transferUsdc, usdcToCents } from "../usdc";
import { getPublicClient } from "../config";
import { sweepDeposits } from "../sweep";

const HOT_ADDRESS = "0x" + "1".repeat(40);
const CURRENT_ADDRESS = "0x" + "2".repeat(40);
const LEGACY_ADDRESS = "0x" + "3".repeat(40);
const TX_HASH = ("0x" + "4".repeat(64)) as `0x${string}`;

const platformAccount = {
  address: HOT_ADDRESS,
  name: "swarm-hot",
  smartAccount: {},
};

const currentAgentAccount = {
  address: CURRENT_ADDRESS,
  name: "agent-current",
  smartAccount: {},
};

const mockWalletFindMany = prisma.wallet.findMany as ReturnType<typeof vi.fn>;
const mockChainCreate = prisma.chainTransaction.create as ReturnType<
  typeof vi.fn
>;
const mockGetPlatformAccount = getPlatformAccount as ReturnType<typeof vi.fn>;
const mockGetOrCreateAgentAccount = getOrCreateAgentAccount as ReturnType<
  typeof vi.fn
>;
const mockGetUsdcBalance = getUsdcBalance as ReturnType<typeof vi.fn>;
const mockTransferUsdc = transferUsdc as ReturnType<typeof vi.fn>;
const mockUsdcToCents = usdcToCents as ReturnType<typeof vi.fn>;
const mockGetPublicClient = getPublicClient as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  mockGetPlatformAccount.mockResolvedValue(platformAccount);
  mockWalletFindMany.mockResolvedValue([
    {
      id: "wallet-1",
      agentId: "agent-1",
      depositAddress: LEGACY_ADDRESS,
      hdDerivationIndex: 1,
    },
  ]);
  mockGetUsdcBalance.mockResolvedValue(10_000n);
  mockGetOrCreateAgentAccount.mockResolvedValue(currentAgentAccount);
  mockTransferUsdc.mockResolvedValue(TX_HASH);
  mockGetPublicClient.mockReturnValue({
    waitForTransactionReceipt: vi.fn().mockResolvedValue({
      blockNumber: 123n,
      gasUsed: 456n,
    }),
  });
  mockUsdcToCents.mockReturnValue(1);
  mockChainCreate.mockResolvedValue({ id: "chain-tx-1" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sweepDeposits", () => {
  it("sweeps a funded current CDP deposit address", async () => {
    mockWalletFindMany.mockResolvedValue([
      {
        id: "wallet-1",
        agentId: "agent-1",
        depositAddress: CURRENT_ADDRESS,
        hdDerivationIndex: 1,
      },
    ]);

    const result = await sweepDeposits();

    expect(mockTransferUsdc).toHaveBeenCalledWith(
      currentAgentAccount,
      HOT_ADDRESS,
      10_000n
    );
    expect(mockChainCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromAddress: CURRENT_ADDRESS,
          toAddress: HOT_ADDRESS,
          amountUsdc: 10_000n,
          amountCents: 1,
          status: "CONFIRMED",
        }),
      })
    );
    expect(result.errors).toEqual([]);
    expect(result.swept).toHaveLength(1);
    expect(result.staleDepositAddresses).toBe(0);
  });

  it("skips a funded stale deposit address without legacy CDP lookup", async () => {
    const result = await sweepDeposits();

    expect(mockGetOrCreateAgentAccount).toHaveBeenCalledWith("agent-1");
    expect(mockTransferUsdc).not.toHaveBeenCalled();
    expect(mockChainCreate).not.toHaveBeenCalled();
    expect(result.errors).toEqual([]);
    expect(result.swept).toHaveLength(0);
    expect(result.staleDepositAddresses).toBe(1);
  });
});
