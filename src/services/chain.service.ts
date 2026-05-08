import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/lib/errors";
import {
  getOrCreateAgentAccount,
  nextDerivationIndex,
  getPlatformAccount,
} from "@/lib/chain/wallet";
import {
  getUsdcBalance,
  submitUsdcTransfer,
  waitForUsdcTransfer,
  isUserOperationFailedError,
  centsToUsdc,
  usdcToCents,
} from "@/lib/chain/usdc";
import { verifyDeposit } from "@/lib/chain/deposit-verifier";
import { notify } from "@/services/notification.service";
import type { Prisma } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Initialize Wallet (internal — called during agent registration)
// ---------------------------------------------------------------------------

type TxClient = Prisma.TransactionClient;

export interface AdvertiserWalletDerivation {
  depositAddress: string;
  hdIndex: number;
}

/**
 * Derive a CDP-managed Base deposit address for an agent. This is a CDP API
 * call; it must happen outside any DB transaction because it can be slow and
 * would otherwise hold a Postgres transaction open on the network.
 */
export async function deriveAdvertiserWalletAddress(
  agentId: string
): Promise<AdvertiserWalletDerivation> {
  const hdIndex = await nextDerivationIndex();
  const cdpAccount = await getOrCreateAgentAccount(agentId);
  return { depositAddress: cdpAccount.address, hdIndex };
}

/**
 * Write a derived CDP address onto an existing wallet row. Accepts an optional
 * transaction client so it can participate in the `registerAgent` transaction.
 *
 * Called during registration — there's no longer a public endpoint for this;
 * every advertiser exits registration with a usable deposit address.
 */
export async function applyAdvertiserWalletInit(
  walletId: string,
  derivation: AdvertiserWalletDerivation,
  tx?: TxClient
) {
  const db = tx ?? prisma;
  return db.wallet.update({
    where: { id: walletId },
    data: {
      walletType: "CUSTODIAL",
      chainAddress: derivation.depositAddress,
      hdDerivationIndex: derivation.hdIndex,
      depositAddress: derivation.depositAddress,
    },
  });
}

// ---------------------------------------------------------------------------
// Process Onchain Deposit
// ---------------------------------------------------------------------------

export async function processOnchainDeposit(agentId: string, txHash: string) {
  // 1. Fast-path idempotency: tx already processed
  const existing = await prisma.chainTransaction.findUnique({
    where: { txHash },
  });
  if (existing) {
    return { chainTransaction: existing, alreadyProcessed: true };
  }

  const wallet = await prisma.wallet.findUnique({ where: { agentId } });
  if (!wallet) {
    throw new NotFoundError("Wallet for agent", agentId);
  }

  if (!wallet.depositAddress) {
    throw new ValidationError(
      "Wallet has no deposit address. Initialize the wallet first."
    );
  }

  // 2. Verify the deposit onchain (no DB writes yet — slow network call)
  const verification = await verifyDeposit(
    txHash as `0x${string}`,
    wallet.depositAddress,
    1 // minimum 1 cent
  );

  if (!verification.verified) {
    throw new ValidationError(
      "Transaction could not be verified as a valid USDC deposit to the expected address"
    );
  }

  const amountCents = verification.amountCents!;

  // 3. Atomic DB writes: create chain tx + credit wallet + ledger entry.
  // If two requests race past the fast-path check, the unique constraint on
  // txHash will reject the loser — we catch it and return alreadyProcessed.
  let chainTransaction;
  try {
    chainTransaction = await prisma.$transaction(async (tx) => {
      const ct = await tx.chainTransaction.create({
        data: {
          walletId: wallet.id,
          direction: "INBOUND",
          txHash,
          fromAddress: verification.fromAddress,
          toAddress: verification.toAddress,
          amountUsdc: verification.amountUsdc!,
          amountCents,
          status: "CONFIRMED",
          blockNumber: verification.blockNumber,
          confirmedAt: new Date(),
        },
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { availableCents: { increment: amountCents } },
      });

      await tx.ledgerEntry.create({
        data: {
          transactionId: randomUUID(),
          debitAccountType: "EXTERNAL",
          debitAccountId: null,
          creditAccountType: "WALLET",
          creditAccountId: wallet.id,
          amountCents,
          entryType: "CHAIN_DEPOSIT",
          referenceType: "CHAIN_TX",
          referenceId: ct.id,
          memo: `Onchain USDC deposit ${txHash}${
            verification.fromAddress ? ` from ${verification.fromAddress}` : ""
          } → ${amountCents} cents`,
        },
      });

      return ct;
    });
  } catch (err) {
    // P2002 = Prisma unique-constraint violation (raced against another worker)
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      const raced = await prisma.chainTransaction.findUnique({
        where: { txHash },
      });
      if (raced) return { chainTransaction: raced, alreadyProcessed: true };
    }
    throw err;
  }

  notify({
    type: "deposit.confirmed",
    data: {
      chainTransactionId: chainTransaction.id,
      agentId,
      walletId: wallet.id,
      amountCents,
      txHash,
    },
  });

  return { chainTransaction, alreadyProcessed: false };
}

// ---------------------------------------------------------------------------
// Send Payout
// ---------------------------------------------------------------------------

export async function sendPayout(payoutRequestId: string) {
  const payout = await prisma.payoutRequest.findUnique({
    where: { id: payoutRequestId },
    include: { wallet: true },
  });

  if (!payout) {
    throw new NotFoundError("PayoutRequest", payoutRequestId);
  }

  if (payout.status !== "PENDING") {
    throw new ValidationError(`Payout is already ${payout.status}`);
  }

  if (payout.method !== "CRYPTO") {
    throw new ValidationError("sendPayout only handles CRYPTO payouts");
  }

  const destination = payout.destination as Record<string, unknown>;
  const chainAddress = destination.chainAddress as string | undefined;

  if (!chainAddress) {
    throw new ValidationError("Payout destination missing chainAddress");
  }

  const amountUsdc = centsToUsdc(payout.amountCents);
  const platformAccount = await getPlatformAccount();

  // Atomic PENDING → PROCESSING claim. If the payout isn't PENDING (because
  // another worker already grabbed it, or because it's in a failure-recovery
  // state) this no-ops and we exit idempotent. Prevents the race where two
  // crons tick the same payout before either finishes.
  const claimed = await prisma.payoutRequest.updateMany({
    where: { id: payoutRequestId, status: "PENDING" },
    data: { status: "PROCESSING", processedAt: new Date() },
  });
  if (claimed.count === 0) {
    return {
      success: false,
      error: `Payout ${payoutRequestId} is no longer PENDING (already claimed by another worker or in terminal state)`,
    };
  }

  notify({
    type: "payout.processing",
    data: {
      payoutRequestId,
      affiliateId: payout.affiliateId,
      amountCents: payout.amountCents,
      method: "CRYPTO",
    },
  });

  const idempotencyKey = `payout:${payoutRequestId}`;

  // Create chain transaction record before submission so the idempotency key is
  // durable even if the worker dies around the CDP call.
  const chainTx = await prisma.chainTransaction.create({
    data: {
      walletId: payout.walletId,
      payoutRequestId,
      direction: "OUTBOUND",
      idempotencyKey,
      fromAddress: platformAccount.address,
      toAddress: chainAddress,
      amountUsdc,
      amountCents: payout.amountCents,
      status: "PENDING_SUBMISSION",
    },
  });

  let submittedUserOpHash: `0x${string}` | null = null;

  try {
    const submitted = await submitUsdcTransfer(
      platformAccount,
      chainAddress as `0x${string}`,
      amountUsdc,
      { idempotencyKey }
    );
    submittedUserOpHash = submitted.userOpHash;

    await prisma.chainTransaction.update({
      where: { id: chainTx.id },
      data: {
        status: "SUBMITTED",
        userOpHash: submitted.userOpHash,
        errorMessage: null,
      },
    });

    const { txHash } = await waitForUsdcTransfer(
      platformAccount.address,
      submitted.userOpHash
    );

    // Wait for confirmation
    const { getPublicClient } = await import("@/lib/chain/config");
    const client = getPublicClient();
    const receipt = await client.waitForTransactionReceipt({ hash: txHash });

    // Update chain transaction
    await prisma.chainTransaction.update({
      where: { id: chainTx.id },
      data: {
        txHash,
        status: "CONFIRMED",
        blockNumber: receipt.blockNumber,
        gasUsedWei: receipt.gasUsed,
        errorMessage: null,
        confirmedAt: new Date(),
      },
    });

    // Update payout request
    await prisma.payoutRequest.update({
      where: { id: payoutRequestId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    // Reduce pending payout cents
    await prisma.wallet.update({
      where: { id: payout.walletId },
      data: {
        pendingPayoutCents: { decrement: payout.amountCents },
      },
    });

    // Ledger entry
    await prisma.ledgerEntry.create({
      data: {
        transactionId: randomUUID(),
        debitAccountType: "PLATFORM_RESERVE",
        debitAccountId: payoutRequestId,
        creditAccountType: "WALLET",
        creditAccountId: payout.walletId,
        amountCents: payout.amountCents,
        entryType: "CHAIN_PAYOUT",
        referenceType: "CHAIN_TX",
        referenceId: chainTx.id,
        memo: `Onchain USDC payout ${txHash} → ${chainAddress}`,
      },
    });

    // Domain event
    await prisma.domainEvent.create({
      data: {
        aggregateType: "PayoutRequest",
        aggregateId: payoutRequestId,
        eventType: "PayoutCompleted",
        payload: {
          payoutRequestId,
          txHash,
          amountCents: payout.amountCents,
          chainAddress,
        } as unknown as Prisma.InputJsonValue,
        version: 1,
      },
    });

    notify({
      type: "payout.completed",
      data: {
        payoutRequestId,
        affiliateId: payout.affiliateId,
        amountCents: payout.amountCents,
        txHash,
        chainAddress,
      },
    });

    return { success: true, txHash, chainTransactionId: chainTx.id };
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error during payout";

    if (submittedUserOpHash && !isUserOperationFailedError(err)) {
      await prisma.chainTransaction.update({
        where: { id: chainTx.id },
        data: {
          status: "SUBMITTED",
          userOpHash: submittedUserOpHash,
          errorMessage,
        },
      });

      return {
        success: false,
        error: errorMessage,
        chainTransactionId: chainTx.id,
        inFlight: true,
      };
    }

    // Mark chain transaction as failed
    await prisma.chainTransaction.update({
      where: { id: chainTx.id },
      data: { status: "FAILED", errorMessage },
    });

    // Revert payout: move funds back to available
    await prisma.payoutRequest.update({
      where: { id: payoutRequestId },
      data: { status: "FAILED", failureReason: errorMessage },
    });

    await prisma.wallet.update({
      where: { id: payout.walletId },
      data: {
        pendingPayoutCents: { decrement: payout.amountCents },
        availableCents: { increment: payout.amountCents },
      },
    });

    notify({
      type: "payout.failed",
      data: {
        payoutRequestId,
        affiliateId: payout.affiliateId,
        amountCents: payout.amountCents,
        reason: errorMessage,
      },
    });

    return {
      success: false,
      error: errorMessage,
      chainTransactionId: chainTx.id,
    };
  }
}

// ---------------------------------------------------------------------------
// Recover Stuck PROCESSING Payouts
// ---------------------------------------------------------------------------
// Called by /api/cron/process-payouts for rows stuck in PROCESSING past a
// threshold. Handles the three non-in-flight cases. Rows that still look
// actively in flight (chainTransaction.status === "SUBMITTED" with an
// unconfirmed on-chain tx) are left alone for the next cron tick.

export type RecoverOutcome =
  | "reset_to_pending"
  | "finalized_completed"
  | "finalized_failed"
  | "in_flight_skipped";

export async function recoverStuckPayout(
  payoutRequestId: string
): Promise<{ outcome: RecoverOutcome; detail?: string }> {
  const payout = await prisma.payoutRequest.findUnique({
    where: { id: payoutRequestId },
    include: { chainTransaction: true },
  });
  if (!payout) throw new NotFoundError("PayoutRequest", payoutRequestId);
  if (payout.status !== "PROCESSING") {
    return {
      outcome: "in_flight_skipped",
      detail: `payout already in terminal state ${payout.status}`,
    };
  }

  const chainTx = payout.chainTransaction;

  // Case A: never made it past the status claim. No funds moved. Reset.
  if (!chainTx) {
    await prisma.payoutRequest.update({
      where: { id: payout.id },
      data: { status: "PENDING", processedAt: null },
    });
    return { outcome: "reset_to_pending", detail: "no chain transaction row" };
  }

  const recoveryPayout = payout;
  const recoveryChainTx = chainTx;

  async function finalizeCompleted(txHash: string, detail: string) {
    await prisma.$transaction([
      prisma.payoutRequest.update({
        where: { id: recoveryPayout.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      }),
      prisma.wallet.update({
        where: { id: recoveryPayout.walletId },
        data: { pendingPayoutCents: { decrement: recoveryPayout.amountCents } },
      }),
      prisma.ledgerEntry.create({
        data: {
          transactionId: randomUUID(),
          debitAccountType: "PLATFORM_RESERVE",
          debitAccountId: recoveryPayout.id,
          creditAccountType: "WALLET",
          creditAccountId: recoveryPayout.walletId,
          amountCents: recoveryPayout.amountCents,
          entryType: "CHAIN_PAYOUT",
          referenceType: "CHAIN_TX",
          referenceId: recoveryChainTx.id,
          memo: `Onchain USDC payout ${txHash} (recovered from stuck PROCESSING)`,
        },
      }),
      prisma.domainEvent.create({
        data: {
          aggregateType: "PayoutRequest",
          aggregateId: recoveryPayout.id,
          eventType: "PayoutCompletedViaRecovery",
          payload: {
            payoutRequestId: recoveryPayout.id,
            txHash,
            amountCents: recoveryPayout.amountCents,
          } as unknown as Prisma.InputJsonValue,
          version: 1,
        },
      }),
    ]);

    notify({
      type: "payout.completed",
      data: {
        payoutRequestId: recoveryPayout.id,
        affiliateId: recoveryPayout.affiliateId,
        amountCents: recoveryPayout.amountCents,
        txHash,
        chainAddress: recoveryChainTx.toAddress ?? undefined,
      },
    });

    return { outcome: "finalized_completed" as const, detail };
  }

  async function finalizeFailed(reason: string) {
    await prisma.$transaction([
      prisma.payoutRequest.update({
        where: { id: recoveryPayout.id },
        data: { status: "FAILED", failureReason: reason },
      }),
      prisma.wallet.update({
        where: { id: recoveryPayout.walletId },
        data: {
          pendingPayoutCents: { decrement: recoveryPayout.amountCents },
          availableCents: { increment: recoveryPayout.amountCents },
        },
      }),
    ]);

    notify({
      type: "payout.failed",
      data: {
        payoutRequestId: recoveryPayout.id,
        affiliateId: recoveryPayout.affiliateId,
        amountCents: recoveryPayout.amountCents,
        reason,
      },
    });

    return { outcome: "finalized_failed" as const, detail: reason };
  }

  // Case B: chain says CONFIRMED but DB never finalized. Money left the
  // platform wallet; we just need to complete the bookkeeping.
  if (chainTx.status === "CONFIRMED" && chainTx.txHash) {
    return finalizeCompleted(
      chainTx.txHash,
      `tx ${chainTx.txHash} already confirmed`
    );
  }

  // Case C: chain says FAILED. Refund the affiliate, mark payout FAILED.
  if (chainTx.status === "FAILED") {
    const reason = chainTx.errorMessage ?? "Chain transaction failed";
    return finalizeFailed(reason);
  }

  if (chainTx.status === "SUBMITTED" && chainTx.userOpHash) {
    try {
      const { txHash } = await waitForUsdcTransfer(
        chainTx.fromAddress as `0x${string}`,
        chainTx.userOpHash as `0x${string}`
      );
      const { getPublicClient } = await import("@/lib/chain/config");
      const client = getPublicClient();
      const receipt = await client.waitForTransactionReceipt({ hash: txHash });

      await prisma.chainTransaction.update({
        where: { id: chainTx.id },
        data: {
          txHash,
          status: "CONFIRMED",
          blockNumber: receipt.blockNumber,
          gasUsedWei: receipt.gasUsed,
          errorMessage: null,
          confirmedAt: new Date(),
        },
      });

      return finalizeCompleted(
        txHash,
        `user op ${chainTx.userOpHash} completed as tx ${txHash}`
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Unknown user operation recovery error";

      if (!isUserOperationFailedError(err)) {
        await prisma.chainTransaction.update({
          where: { id: chainTx.id },
          data: { errorMessage },
        });
        return {
          outcome: "in_flight_skipped",
          detail: `user op ${chainTx.userOpHash} still unresolved: ${errorMessage}`,
        };
      }

      await prisma.chainTransaction.update({
        where: { id: chainTx.id },
        data: { status: "FAILED", errorMessage },
      });
      return finalizeFailed(errorMessage);
    }
  }

  // Case D: chainTransaction.status is still SUBMITTED. The tx may actually
  // be live and waiting for a receipt — don't touch it. The cron will retry
  // on the next tick. Manual intervention may be needed if this persists.
  return {
    outcome: "in_flight_skipped",
    detail: `chain tx still ${chainTx.status}${chainTx.txHash ? " with txHash " + chainTx.txHash : " without txHash"}`,
  };
}

// ---------------------------------------------------------------------------
// Get Onchain Balance
// ---------------------------------------------------------------------------

export async function getOnchainBalance(address: string) {
  const balanceUsdc = await getUsdcBalance(address as `0x${string}`);
  const balanceCents = usdcToCents(balanceUsdc);
  return { balanceUsdc: balanceUsdc.toString(), balanceCents };
}
