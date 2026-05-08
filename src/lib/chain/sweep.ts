import { prisma } from "@/lib/prisma";
import {
  getPlatformAccount,
  getOrCreateAgentAccount,
  type ChainAccount,
} from "./wallet";
import { getUsdcBalance, transferUsdc, usdcToCents } from "./usdc";
import { getPublicClient } from "./config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SweepResult {
  walletId: string;
  agentId: string;
  depositAddress: string;
  amountUsdc: string;
  amountCents: number;
  txHash: string;
  chainTransactionId: string;
}

interface SweepError {
  walletId: string;
  agentId: string;
  depositAddress: string;
  error: string;
}

interface SweepSummary {
  swept: SweepResult[];
  skipped: number;
  staleDepositAddresses: number;
  errors: SweepError[];
  totalAmountCents: number;
}

function sameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

async function getSweepSourceAccount(
  agentId: string,
  depositAddress: `0x${string}`
): Promise<ChainAccount | null> {
  const currentAccount = await getOrCreateAgentAccount(agentId);

  if (sameAddress(currentAccount.address, depositAddress)) {
    return currentAccount;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Sweep Deposits
// ---------------------------------------------------------------------------

/**
 * Sweep USDC from current CDP-backed deposit addresses to the platform hot wallet.
 *
 * Iterates every wallet with a platform-controlled deposit address, checks the
 * on-chain USDC balance, and transfers any non-zero balance to the hot wallet.
 * Stale pre-migration addresses are skipped instead of retried through legacy
 * CDP lookup, because CDP cannot recover abandoned non-current accounts.
 *
 * Errors on individual wallets are captured but do not abort the sweep.
 */
export async function sweepDeposits(): Promise<SweepSummary> {
  const platformAccount = await getPlatformAccount();
  const hotWalletAddress = platformAccount.address;

  // All wallets with a platform-controlled deposit address.
  const wallets = await prisma.wallet.findMany({
    where: {
      hdDerivationIndex: { not: null },
      depositAddress: { not: null },
      NOT: { depositAddress: hotWalletAddress },
    },
    select: {
      id: true,
      agentId: true,
      depositAddress: true,
      hdDerivationIndex: true,
    },
  });

  const swept: SweepResult[] = [];
  const errors: SweepError[] = [];
  let skipped = 0;
  let staleDepositAddresses = 0;

  for (const wallet of wallets) {
    const depositAddress = wallet.depositAddress as `0x${string}`;

    try {
      const balance = await getUsdcBalance(depositAddress);

      if (balance <= 0n) {
        skipped++;
        continue;
      }

      const fromAccount = await getSweepSourceAccount(
        wallet.agentId,
        depositAddress
      );

      if (!fromAccount) {
        staleDepositAddresses++;
        continue;
      }

      const txHash = await transferUsdc(fromAccount, hotWalletAddress, balance);

      // Wait for confirmation
      const client = getPublicClient();
      const receipt = await client.waitForTransactionReceipt({ hash: txHash });

      const amountCents = usdcToCents(balance);

      // Record the chain transaction
      const chainTx = await prisma.chainTransaction.create({
        data: {
          walletId: wallet.id,
          direction: "INBOUND",
          txHash,
          fromAddress: depositAddress,
          toAddress: hotWalletAddress,
          amountUsdc: balance,
          amountCents,
          status: "CONFIRMED",
          blockNumber: receipt.blockNumber,
          gasUsedWei: receipt.gasUsed,
          confirmedAt: new Date(),
        },
      });

      console.log(
        `[sweep] Swept ${amountCents} cents from ${depositAddress} (wallet ${wallet.id}) → ${hotWalletAddress} tx=${txHash}`
      );

      swept.push({
        walletId: wallet.id,
        agentId: wallet.agentId,
        depositAddress,
        amountUsdc: balance.toString(),
        amountCents,
        txHash,
        chainTransactionId: chainTx.id,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error during sweep";

      console.error(
        `[sweep] Error sweeping wallet ${wallet.id} (${depositAddress}): ${errorMessage}`
      );

      errors.push({
        walletId: wallet.id,
        agentId: wallet.agentId,
        depositAddress,
        error: errorMessage,
      });
    }
  }

  const totalAmountCents = swept.reduce((sum, r) => sum + r.amountCents, 0);

  console.log(
    `[sweep] Complete: ${swept.length} swept, ${skipped} skipped (zero balance), ${staleDepositAddresses} stale deposit addresses skipped, ${errors.length} errors, total ${totalAmountCents} cents`
  );

  return { swept, skipped, staleDepositAddresses, errors, totalAmountCents };
}
