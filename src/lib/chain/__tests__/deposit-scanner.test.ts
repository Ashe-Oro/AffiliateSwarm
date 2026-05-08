import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetBlockNumber = vi.fn();
const mockGetLogs = vi.fn();

vi.mock("@/lib/chain/config", () => ({
  getPublicClient: () => ({
    getBlockNumber: mockGetBlockNumber,
    getLogs: mockGetLogs,
  }),
  USDC_ADDRESS: "0x" + "u".repeat(40),
  USDC_ABI: [
    {
      type: "event",
      name: "Transfer",
      inputs: [
        { name: "from", type: "address", indexed: true },
        { name: "to", type: "address", indexed: true },
        { name: "value", type: "uint256", indexed: false },
      ],
    },
  ],
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    wallet: { findMany: vi.fn() },
  },
}));

vi.mock("@/services/chain.service", () => ({
  processOnchainDeposit: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { processOnchainDeposit } from "@/services/chain.service";
import { scanForDeposits } from "../deposit-scanner";

const mockFindMany = prisma.wallet.findMany as ReturnType<typeof vi.fn>;
const mockProcess = processOnchainDeposit as ReturnType<typeof vi.fn>;

const ADDR_A = "0x" + "a".repeat(40);
const ADDR_B = "0x" + "b".repeat(40);
const TX_1 = "0x" + "1".repeat(64);
const TX_2 = "0x" + "2".repeat(64);
const TX_3 = "0x" + "3".repeat(64);

function makeLogs(
  entries: Array<{ to: string; txHash: string; value?: bigint }>
) {
  return entries.map((e) => ({
    transactionHash: e.txHash,
    args: { to: e.to, value: e.value ?? 10_000n },
  }));
}

describe("scanForDeposits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBlockNumber.mockResolvedValue(10000n);
    mockGetLogs.mockResolvedValue([]);
  });

  it("returns early with zeros when no deposit addresses exist", async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await scanForDeposits();

    expect(result.depositsFound).toBe(0);
    expect(result.depositsProcessed).toBe(0);
    expect(result.depositsSkipped).toBe(0);
    expect(result.dustDepositsSkipped).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.chunks).toBe(0);
    expect(mockGetBlockNumber).not.toHaveBeenCalled();
    expect(mockGetLogs).not.toHaveBeenCalled();
  });

  it("detects and processes a single deposit", async () => {
    mockFindMany.mockResolvedValue([
      { agentId: "agent-a", depositAddress: ADDR_A },
    ]);
    mockGetLogs.mockResolvedValue(
      makeLogs([{ to: ADDR_A, txHash: TX_1 }])
    );
    mockProcess.mockResolvedValue({
      chainTransaction: { id: "ct-1" },
      alreadyProcessed: false,
    });

    const result = await scanForDeposits();

    expect(result.depositsFound).toBe(1);
    expect(result.depositsProcessed).toBe(1);
    expect(result.depositsSkipped).toBe(0);
    expect(mockProcess).toHaveBeenCalledWith("agent-a", TX_1);
  });

  it("skips sub-cent dust transfers before verification", async () => {
    mockFindMany.mockResolvedValue([
      { agentId: "agent-a", depositAddress: ADDR_A },
    ]);
    mockGetLogs.mockResolvedValue(
      makeLogs([{ to: ADDR_A, txHash: TX_1, value: 99n }])
    );

    const result = await scanForDeposits();

    expect(result.depositsFound).toBe(1);
    expect(result.depositsProcessed).toBe(0);
    expect(result.depositsSkipped).toBe(1);
    expect(result.dustDepositsSkipped).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(mockProcess).not.toHaveBeenCalled();
  });

  it("routes multiple deposits to correct agents", async () => {
    mockFindMany.mockResolvedValue([
      { agentId: "agent-a", depositAddress: ADDR_A },
      { agentId: "agent-b", depositAddress: ADDR_B },
    ]);
    mockGetLogs.mockResolvedValue(
      makeLogs([
        { to: ADDR_A, txHash: TX_1 },
        { to: ADDR_B, txHash: TX_2 },
        { to: ADDR_A, txHash: TX_3 },
      ])
    );
    mockProcess.mockResolvedValue({
      chainTransaction: { id: "ct" },
      alreadyProcessed: false,
    });

    const result = await scanForDeposits();

    expect(result.depositsFound).toBe(3);
    expect(result.depositsProcessed).toBe(3);
    expect(mockProcess).toHaveBeenCalledWith("agent-a", TX_1);
    expect(mockProcess).toHaveBeenCalledWith("agent-b", TX_2);
    expect(mockProcess).toHaveBeenCalledWith("agent-a", TX_3);
  });

  it("counts already-processed deposits as skipped", async () => {
    mockFindMany.mockResolvedValue([
      { agentId: "agent-a", depositAddress: ADDR_A },
    ]);
    mockGetLogs.mockResolvedValue(
      makeLogs([{ to: ADDR_A, txHash: TX_1 }])
    );
    mockProcess.mockResolvedValue({
      chainTransaction: { id: "ct-1" },
      alreadyProcessed: true,
    });

    const result = await scanForDeposits();

    expect(result.depositsProcessed).toBe(0);
    expect(result.depositsSkipped).toBe(1);
  });

  it("continues processing when one deposit fails", async () => {
    mockFindMany.mockResolvedValue([
      { agentId: "agent-a", depositAddress: ADDR_A },
    ]);
    mockGetLogs.mockResolvedValue(
      makeLogs([
        { to: ADDR_A, txHash: TX_1 },
        { to: ADDR_A, txHash: TX_2 },
        { to: ADDR_A, txHash: TX_3 },
      ])
    );
    mockProcess
      .mockResolvedValueOnce({ chainTransaction: { id: "ct-1" }, alreadyProcessed: false })
      .mockRejectedValueOnce(new Error("Verification failed"))
      .mockResolvedValueOnce({ chainTransaction: { id: "ct-3" }, alreadyProcessed: false });

    const result = await scanForDeposits();

    expect(result.depositsProcessed).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].txHash).toBe(TX_2);
    expect(result.errors[0].error).toBe("Verification failed");
  });

  it("issues a single getLogs call when range ≤ 1000 blocks (default)", async () => {
    mockFindMany.mockResolvedValue([
      { agentId: "agent-a", depositAddress: ADDR_A },
    ]);
    mockGetBlockNumber.mockResolvedValue(5000n);
    mockGetLogs.mockResolvedValue([]);

    const result = await scanForDeposits();

    expect(result.chunks).toBe(1);
    // Default lookback = 1000 → span is exactly 1000 blocks inclusive
    expect(result.blockRange.from).toBe(4001n);
    expect(result.blockRange.to).toBe(5000n);
    expect(mockGetLogs).toHaveBeenCalledTimes(1);
    expect(mockGetLogs).toHaveBeenCalledWith(
      expect.objectContaining({ fromBlock: 4001n, toBlock: 5000n })
    );
  });

  it("chunks lookback into ≤1000-block getLogs windows (provider cap)", async () => {
    mockFindMany.mockResolvedValue([
      { agentId: "agent-a", depositAddress: ADDR_A },
    ]);
    mockGetBlockNumber.mockResolvedValue(5000n);
    mockGetLogs.mockResolvedValue([]);

    // 2500 blocks inclusive (2501..5000) → 3 chunks: 1000 + 1000 + 500
    const result = await scanForDeposits(2500n);

    expect(result.chunks).toBe(3);
    expect(mockGetLogs).toHaveBeenCalledTimes(3);

    const calls = mockGetLogs.mock.calls.map(([args]) => ({
      from: args.fromBlock as bigint,
      to: args.toBlock as bigint,
    }));
    // Every chunk must be ≤ 1000 blocks wide (inclusive count)
    for (const c of calls) {
      expect(c.to - c.from + 1n).toBeLessThanOrEqual(1000n);
    }
    // Coverage: chunks together span [fromBlock, currentBlock] with no gaps
    expect(calls[0].from).toBe(2501n);
    expect(calls[calls.length - 1].to).toBe(5000n);
    // Adjacent chunks meet exactly: prev.to + 1 = next.from
    for (let i = 1; i < calls.length; i++) {
      expect(calls[i].from).toBe(calls[i - 1].to + 1n);
    }
  });

  it("aggregates logs across multiple chunks", async () => {
    mockFindMany.mockResolvedValue([
      { agentId: "agent-a", depositAddress: ADDR_A },
    ]);
    mockGetBlockNumber.mockResolvedValue(5000n);
    mockGetLogs
      .mockResolvedValueOnce(makeLogs([{ to: ADDR_A, txHash: TX_1 }]))
      .mockResolvedValueOnce(makeLogs([{ to: ADDR_A, txHash: TX_2 }]))
      .mockResolvedValueOnce(makeLogs([{ to: ADDR_A, txHash: TX_3 }]));
    mockProcess.mockResolvedValue({
      chainTransaction: { id: "ct" },
      alreadyProcessed: false,
    });

    const result = await scanForDeposits(2500n);

    expect(result.chunks).toBe(3);
    expect(result.depositsFound).toBe(3);
    expect(result.depositsProcessed).toBe(3);
  });

  it("does not go below block 0 for small block numbers", async () => {
    mockFindMany.mockResolvedValue([
      { agentId: "agent-a", depositAddress: ADDR_A },
    ]);
    mockGetBlockNumber.mockResolvedValue(500n);
    mockGetLogs.mockResolvedValue([]);

    const result = await scanForDeposits(2500n);

    expect(result.blockRange.from).toBe(0n);
    // Single chunk since total span is 500 blocks (< 1000)
    expect(result.chunks).toBe(1);
  });

  it("caps lookback at MAX_LOOKBACK_BLOCKS and still chunks it", async () => {
    mockFindMany.mockResolvedValue([
      { agentId: "agent-a", depositAddress: ADDR_A },
    ]);
    mockGetBlockNumber.mockResolvedValue(100_000n);
    mockGetLogs.mockResolvedValue([]);

    // Ask for 50k blocks; scanner caps at 10k → exactly 10 chunks of 1000
    const result = await scanForDeposits(50_000n);

    expect(result.blockRange.from).toBe(90_001n);
    expect(result.chunks).toBe(10);
    for (const [args] of mockGetLogs.mock.calls) {
      expect((args.toBlock as bigint) - (args.fromBlock as bigint) + 1n).toBeLessThanOrEqual(1000n);
    }
  });

  it("propagates RPC errors from getLogs", async () => {
    mockFindMany.mockResolvedValue([
      { agentId: "agent-a", depositAddress: ADDR_A },
    ]);
    mockGetLogs.mockRejectedValue(new Error("RPC timeout"));

    await expect(scanForDeposits()).rejects.toThrow("RPC timeout");
  });

  it("performs case-insensitive address matching", async () => {
    mockFindMany.mockResolvedValue([
      { agentId: "agent-a", depositAddress: ADDR_A.toUpperCase() },
    ]);
    mockGetLogs.mockResolvedValue(
      makeLogs([{ to: ADDR_A.toLowerCase(), txHash: TX_1 }])
    );
    mockProcess.mockResolvedValue({
      chainTransaction: { id: "ct-1" },
      alreadyProcessed: false,
    });

    const result = await scanForDeposits();

    expect(result.depositsProcessed).toBe(1);
  });
});
