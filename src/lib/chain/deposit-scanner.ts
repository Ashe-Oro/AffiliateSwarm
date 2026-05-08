import { getPublicClient, USDC_ADDRESS, USDC_ABI } from "./config";
import { prisma } from "@/lib/prisma";
import { processOnchainDeposit } from "@/services/chain.service";

// Coinbase Developer RPC (and most public Base RPCs) cap eth_getLogs at 1000
// blocks per request. We split the lookback window into chunks of this size
// and aggregate. Smaller chunks are fine; larger ones get rejected.
const RPC_GETLOGS_MAX_BLOCKS = 1000n;

// 1000 blocks on Base ≈ 33 min at 2s block time. Cron runs every 2 min, so
// even a single-chunk scan gives ~16× overlap — plenty of redundancy against
// reorgs and missed ticks.
const DEFAULT_LOOKBACK_BLOCKS = 1000n;

// processOnchainDeposit verifies a minimum of 1 cent. Filter dust here so
// harmless sub-cent transfers do not become noisy retry errors during overlap.
const MIN_DEPOSIT_BASE_UNITS = 10_000n;

// Safety ceiling for callers that pass a larger lookback (e.g. a one-off
// recovery scan). Still chunks internally — no single getLogs exceeds the
// provider cap.
const MAX_LOOKBACK_BLOCKS = 10_000n;

interface ScanResult {
  blockRange: { from: bigint; to: bigint };
  chunks: number;
  depositsFound: number;
  depositsProcessed: number;
  depositsSkipped: number;
  dustDepositsSkipped: number;
  errors: Array<{ txHash: string; error: string }>;
}

export async function scanForDeposits(
  lookbackBlocks: bigint = DEFAULT_LOOKBACK_BLOCKS
): Promise<ScanResult> {
  const wallets = await prisma.wallet.findMany({
    where: {
      status: "ACTIVE",
      depositAddress: { not: null },
      hdDerivationIndex: { not: null },
    },
    select: { agentId: true, depositAddress: true },
  });

  if (wallets.length === 0) {
    return {
      blockRange: { from: 0n, to: 0n },
      chunks: 0,
      depositsFound: 0,
      depositsProcessed: 0,
      depositsSkipped: 0,
      dustDepositsSkipped: 0,
      errors: [],
    };
  }

  const addressToAgent = new Map<string, string>();
  for (const w of wallets) {
    addressToAgent.set(w.depositAddress!.toLowerCase(), w.agentId);
  }

  const client = getPublicClient();
  const currentBlock = await client.getBlockNumber();
  const effectiveLookback =
    lookbackBlocks > MAX_LOOKBACK_BLOCKS ? MAX_LOOKBACK_BLOCKS : lookbackBlocks;
  // Inclusive range: "lookback = N" means exactly N blocks including
  // currentBlock. Using `currentBlock - N` (without the +1) would span N+1
  // blocks inclusive, which is how the pre-chunking code blew past the
  // provider's 1000-block cap.
  const fromBlock =
    currentBlock >= effectiveLookback ? currentBlock - effectiveLookback + 1n : 0n;

  const depositAddresses = wallets.map(
    (w) => w.depositAddress as `0x${string}`
  );

  // Chunk the range so no single getLogs exceeds the provider cap.
  const allLogs: Awaited<ReturnType<typeof client.getLogs>> = [];
  let chunks = 0;
  for (
    let chunkFrom = fromBlock;
    chunkFrom <= currentBlock;
    chunkFrom += RPC_GETLOGS_MAX_BLOCKS
  ) {
    // chunkTo is inclusive; cap at currentBlock. The -1n keeps chunks
    // non-overlapping (e.g. [0..999], [1000..1999], ...).
    const chunkEndCandidate = chunkFrom + RPC_GETLOGS_MAX_BLOCKS - 1n;
    const chunkTo =
      chunkEndCandidate > currentBlock ? currentBlock : chunkEndCandidate;

    const logs = await client.getLogs({
      address: USDC_ADDRESS,
      event: USDC_ABI[0],
      args: { to: depositAddresses },
      fromBlock: chunkFrom,
      toBlock: chunkTo,
    });
    allLogs.push(...logs);
    chunks++;
  }

  const result: ScanResult = {
    blockRange: { from: fromBlock, to: currentBlock },
    chunks,
    depositsFound: allLogs.length,
    depositsProcessed: 0,
    depositsSkipped: 0,
    dustDepositsSkipped: 0,
    errors: [],
  };

  for (const log of allLogs) {
    const txHash = log.transactionHash;
    const args = log.args as { to?: string; value?: bigint };
    const toAddress = args.to?.toLowerCase();
    if (!txHash || !toAddress) continue;

    const agentId = addressToAgent.get(toAddress);
    if (!agentId) continue;

    if (typeof args.value === "bigint" && args.value < MIN_DEPOSIT_BASE_UNITS) {
      result.depositsSkipped++;
      result.dustDepositsSkipped++;
      continue;
    }

    try {
      const { alreadyProcessed } = await processOnchainDeposit(agentId, txHash);
      if (alreadyProcessed) {
        result.depositsSkipped++;
      } else {
        result.depositsProcessed++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[detect-deposits] Failed to process tx ${txHash}: ${msg}`);
      result.errors.push({ txHash, error: msg });
    }
  }

  return result;
}
