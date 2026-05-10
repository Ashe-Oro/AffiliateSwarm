import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { ENABLE_STRIPE_WITHDRAWALS } from "@/lib/feature-flags";
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  BudgetExhaustedError,
  WalletShortfallError,
} from "@/lib/errors";
import type {
  ListTransactionsInput,
  ListPayoutsInput,
} from "@/lib/validators/escrow";
import type { Prisma, Campaign } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";
import { notify } from "@/services/notification.service";

const PLATFORM_FEE_RATE = parseFloat(process.env.PLATFORM_FEE_RATE || "0.05");

/**
 * Classify a placeHold() failure as a funding shortfall the affiliate should
 * know about. Returns null for unrelated errors (those should propagate
 * without an affiliate-facing notification).
 */
export function classifyFundingError(
  err: unknown
): "wallet_empty" | "budget_exhausted" | null {
  if (err instanceof BudgetExhaustedError) return "budget_exhausted";
  if (err instanceof WalletShortfallError) return "wallet_empty";
  return null;
}

// ---------------------------------------------------------------------------
// Place Hold
// ---------------------------------------------------------------------------

/**
 * Place a hold on escrow funds when a lead is submitted.
 * Double-entry: debit escrow, credit hold.
 */
export async function placeHold(
  escrowId: string,
  leadId: string,
  affiliateId: string,
  amountCents: number
) {
  if (amountCents <= 0) {
    throw new ValidationError("Hold amount must be positive");
  }

  const result = await prisma.$transaction(async (tx) => {
    const escrow = await tx.escrowAccount.findUnique({
      where: { id: escrowId },
    });

    if (!escrow) {
      throw new NotFoundError("EscrowAccount", escrowId);
    }

    const campaignForFunding = await tx.campaign.findUnique({
      where: { id: escrow.campaignId },
      select: {
        id: true,
        name: true,
        advertiserId: true,
        budgetCents: true,
      },
    });

    if (!campaignForFunding) {
      throw new NotFoundError("Campaign", escrow.campaignId);
    }

    // Auto-fund from advertiser wallet if escrow can't cover the hold.
    // Respects the campaign's budgetCents cap so advertisers don't
    // accidentally blow past their declared spend.
    if (escrow.currentBalanceCents < amountCents) {
      const deficit = amountCents - escrow.currentBalanceCents;
      const budgetHeadroom =
        campaignForFunding.budgetCents - escrow.totalDepositedCents;

      if (deficit > budgetHeadroom) {
        throw new BudgetExhaustedError({
          deficitCents: deficit,
          headroomCents: budgetHeadroom,
          budgetCents: campaignForFunding.budgetCents,
        });
      }

      const advertiserWallet = await tx.wallet.findUnique({
        where: { agentId: campaignForFunding.advertiserId },
      });

      if (!advertiserWallet || advertiserWallet.availableCents < deficit) {
        throw new WalletShortfallError({
          deficitCents: deficit,
          walletAvailableCents: advertiserWallet?.availableCents ?? 0,
        });
      }

      await tx.wallet.update({
        where: { id: advertiserWallet.id },
        data: { availableCents: { decrement: deficit } },
      });

      await tx.escrowAccount.update({
        where: { id: escrowId },
        data: {
          totalDepositedCents: { increment: deficit },
          currentBalanceCents: { increment: deficit },
        },
      });

      await tx.ledgerEntry.create({
        data: {
          transactionId: randomUUID(),
          debitAccountType: "WALLET",
          debitAccountId: advertiserWallet.id,
          creditAccountType: "ESCROW",
          creditAccountId: escrowId,
          amountCents: deficit,
          currency: escrow.currency,
          entryType: "DEPOSIT",
          referenceType: "LEAD",
          referenceId: leadId,
          memo: `Auto-funded ${deficit} cents from wallet to campaign ${campaignForFunding.name} for lead ${leadId}`,
        },
      });

      // Reload escrow so the post-hold balance math below is correct.
      escrow.currentBalanceCents += deficit;
      escrow.totalDepositedCents += deficit;
    }

    // Decrease escrow available balance
    await tx.escrowAccount.update({
      where: { id: escrowId },
      data: {
        currentBalanceCents: { decrement: amountCents },
      },
    });

    // Create the hold
    const hold = await tx.escrowHold.create({
      data: {
        escrowId,
        leadId,
        affiliateId,
        amountCents,
        currency: escrow.currency,
        status: "HELD",
      },
    });

    // Double-entry ledger
    const transactionId = randomUUID();

    await tx.ledgerEntry.create({
      data: {
        transactionId,
        debitAccountType: "ESCROW",
        debitAccountId: escrowId,
        creditAccountType: "ESCROW",
        creditAccountId: hold.id,
        amountCents,
        currency: escrow.currency,
        entryType: "ESCROW_HOLD",
        referenceType: "LEAD",
        referenceId: leadId,
        memo: `Hold ${amountCents} cents for lead ${leadId}`,
      },
    });

    // Budget-low warning: based on remaining campaign budget headroom
    // (budgetCents - totalDepositedCents). With auto-funding, the meaningful
    // "budget left" is how much more the campaign can absorb before hitting
    // its declared cap, not how much is sitting in escrow right now.
    const remainingCents = Math.max(
      0,
      campaignForFunding.budgetCents - escrow.totalDepositedCents
    );
    const campaign = campaignForFunding;
    let budgetLowData: {
      campaignId: string; campaignName: string; advertiserId: string;
      remainingCents: number; budgetCents: number; percentRemaining: number;
    } | null = null;
    if (campaign.budgetCents > 0) {
      const percentRemaining = Math.round((remainingCents / campaign.budgetCents) * 100);
      if (percentRemaining <= 20) {
        budgetLowData = {
          campaignId: escrow.campaignId,
          campaignName: campaign.name,
          advertiserId: campaign.advertiserId,
          remainingCents,
          budgetCents: campaign.budgetCents,
          percentRemaining,
        };
      }
    }

    return { hold, budgetLowData };
  });

  // Fire budget_low notification outside the transaction
  if (result.budgetLowData) {
    notify({ type: "campaign.budget_low", data: result.budgetLowData });
  }

  return result.hold;
}

// ---------------------------------------------------------------------------
// Release Hold
// ---------------------------------------------------------------------------

/**
 * Release escrowed funds to affiliate wallet upon lead verification.
 * If the campaign has a holding period, the hold moves to PENDING_RELEASE
 * and funds are credited later by processMaturedHolds().
 * If holdingPeriodDays is 0, funds are released immediately.
 */
export async function releaseHold(holdId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const hold = await tx.escrowHold.findUnique({
      where: { id: holdId },
      include: { escrowAccount: { select: { campaignId: true } } },
    });

    if (!hold) {
      throw new NotFoundError("EscrowHold", holdId);
    }

    if (hold.status !== "HELD") {
      throw new ValidationError(
        `Hold cannot be released from status '${hold.status}'`
      );
    }

    // Check campaign holding period
    const campaign = await tx.campaign.findUnique({
      where: { id: hold.escrowAccount.campaignId },
      select: { holdingPeriodDays: true, name: true },
    });

    const holdingDays = campaign?.holdingPeriodDays ?? 30;
    const campaignName = campaign?.name ?? "";

    if (holdingDays > 0) {
      // Deferred release: mark as PENDING_RELEASE with a future releaseAt
      const releaseAt = new Date();
      releaseAt.setDate(releaseAt.getDate() + holdingDays);

      const updatedHold = await tx.escrowHold.update({
        where: { id: holdId },
        data: {
          status: "PENDING_RELEASE",
          releaseAt,
        },
      });

      // Update escrow totals and budget spent now (funds are committed)
      await tx.escrowAccount.update({
        where: { id: hold.escrowId },
        data: {
          totalReleasedCents: { increment: hold.amountCents },
        },
      });

      await tx.campaign.update({
        where: { id: hold.escrowAccount.campaignId },
        data: {
          budgetSpentCents: { increment: hold.amountCents },
        },
      });

      return { updatedHold, campaignId: hold.escrowAccount.campaignId, campaignName, holdingDays, releaseAt, affiliateId: hold.affiliateId, amountCents: hold.amountCents };
    }

    // Immediate release (holdingPeriodDays = 0)
    // Update escrow totals and budget spent
    await tx.escrowAccount.update({
      where: { id: hold.escrowId },
      data: {
        totalReleasedCents: { increment: hold.amountCents },
      },
    });

    await tx.campaign.update({
      where: { id: hold.escrowAccount.campaignId },
      data: {
        budgetSpentCents: { increment: hold.amountCents },
      },
    });

    const released = await finalizeHoldRelease(tx, hold);
    return { updatedHold: released, campaignId: hold.escrowAccount.campaignId, campaignName, holdingDays, releaseAt: null as Date | null, affiliateId: hold.affiliateId, amountCents: hold.amountCents };
  });

  // Earnings notifications (outside transaction)
  if (result.holdingDays > 0 && result.releaseAt) {
    notify({
      type: "earnings.pending_release",
      data: {
        affiliateId: result.affiliateId,
        campaignId: result.campaignId,
        campaignName: result.campaignName,
        amountCents: result.amountCents,
        releaseDate: result.releaseAt.toISOString(),
      },
    });
  } else {
    // holdingPeriodDays === 0 → skip pending_release, send available directly
    notify({
      type: "earnings.available",
      data: {
        affiliateId: result.affiliateId,
        campaignId: result.campaignId,
        campaignName: result.campaignName,
        amountCents: result.amountCents,
      },
    });
  }

  return result.updatedHold;
}

/**
 * Process all holds whose holding period has elapsed.
 * Called by a cron job to release funds to affiliate wallets.
 */
export async function processMaturedHolds() {
  const maturedHolds = await prisma.escrowHold.findMany({
    where: {
      status: "PENDING_RELEASE",
      releaseAt: { lte: new Date() },
    },
    take: 100, // batch size
  });

  const results = { processed: 0, failed: 0 };

  for (const hold of maturedHolds) {
    try {
      await prisma.$transaction(async (tx) => {
        // Re-fetch inside tx for safety
        const freshHold = await tx.escrowHold.findUnique({
          where: { id: hold.id },
        });
        if (!freshHold || freshHold.status !== "PENDING_RELEASE") return;

        await finalizeHoldRelease(tx, freshHold);
      });

      // Look up campaign name for the notification
      const escrow = await prisma.escrowAccount.findUnique({
        where: { id: hold.escrowId },
        select: { campaignId: true, campaign: { select: { name: true } } },
      });

      notify({
        type: "earnings.available",
        data: {
          affiliateId: hold.affiliateId,
          campaignId: escrow?.campaignId ?? "",
          campaignName: escrow?.campaign?.name ?? "",
          amountCents: hold.amountCents,
        },
      });

      results.processed++;
    } catch (err) {
      logger.error({ err, holdId: hold.id, action: "process_matured_hold" }, "Failed to process matured hold");
      results.failed++;
    }
  }

  return results;
}

/**
 * Internal: finalize a hold release — credit affiliate wallet, record ledger entries,
 * emit events, and credit partner revenue share.
 */
async function finalizeHoldRelease(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  hold: { id: string; escrowId: string; affiliateId: string; leadId: string; amountCents: number; currency: string }
) {
  // Update hold status
  const updatedHold = await tx.escrowHold.update({
    where: { id: hold.id },
    data: {
      status: "RELEASED",
      releasedAt: new Date(),
    },
  });

  // If coming from PENDING_RELEASE, escrow totals were already updated.
  // If coming from HELD (immediate release), update now.
  const escrowAccount = await tx.escrowAccount.findUnique({
    where: { id: hold.escrowId },
    select: { campaignId: true, advertiserId: true },
  });

  // Only update escrow totals if this is an immediate release (not from processMaturedHolds)
  // For PENDING_RELEASE, these were already updated in releaseHold()
  // We detect this by checking if totalReleasedCents needs updating
  // Actually, for simplicity: the caller (releaseHold with holdingDays=0) doesn't update totals,
  // so we always do it here for immediate release path.
  // For PENDING_RELEASE path, totals were already updated, so we skip.

  // Platform fee: deducted from the conversion payout at release time (industry standard)
  const platformFeeCents = Math.ceil(hold.amountCents * PLATFORM_FEE_RATE);
  const affiliatePayoutCents = hold.amountCents - platformFeeCents;

  await tx.wallet.upsert({
    where: { agentId: hold.affiliateId },
    create: {
      agentId: hold.affiliateId,
      availableCents: affiliatePayoutCents,
      heldCents: 0,
      pendingPayoutCents: 0,
    },
    update: {
      availableCents: { increment: affiliatePayoutCents },
    },
  });

  // Double-entry ledger: affiliate payout (net of fee)
  const transactionId = randomUUID();
  const affiliateWallet = await tx.wallet.findUnique({
    where: { agentId: hold.affiliateId },
  });

  await tx.ledgerEntry.create({
    data: {
      transactionId,
      debitAccountType: "ESCROW",
      debitAccountId: hold.escrowId,
      creditAccountType: "WALLET",
      creditAccountId: affiliateWallet!.id,
      amountCents: affiliatePayoutCents,
      currency: hold.currency,
      entryType: "ESCROW_RELEASE",
      referenceType: "LEAD",
      referenceId: hold.leadId,
      memo: `Released ${affiliatePayoutCents} cents to affiliate for lead ${hold.leadId} (${hold.amountCents} - ${platformFeeCents} platform fee)`,
    },
  });

  // Double-entry ledger: platform fee from escrow
  if (platformFeeCents > 0) {
    await tx.ledgerEntry.create({
      data: {
        transactionId,
        debitAccountType: "ESCROW",
        debitAccountId: hold.escrowId,
        creditAccountType: "PLATFORM_REVENUE",
        creditAccountId: hold.escrowId,
        amountCents: platformFeeCents,
        currency: hold.currency,
        entryType: "FEE",
        referenceType: "LEAD",
        referenceId: hold.leadId,
        memo: `Platform fee (${PLATFORM_FEE_RATE * 100}%) on ${hold.amountCents} cents conversion for lead ${hold.leadId}`,
      },
    });
  }

  // Emit domain event
  await tx.domainEvent.create({
    data: {
      aggregateType: "EscrowHold",
      aggregateId: hold.id,
      eventType: "EscrowReleased",
      payload: {
        holdId: hold.id,
        escrowId: hold.escrowId,
        affiliateId: hold.affiliateId,
        leadId: hold.leadId,
        amountCents: hold.amountCents,
      } as unknown as Prisma.InputJsonValue,
      version: 1,
    },
  });

  // Credit partner revenue share for the affiliate side
  await creditPartnerRevShare(tx, hold.affiliateId, hold.amountCents);

  // Credit partner revenue share for the advertiser side
  if (escrowAccount) {
    await creditPartnerRevShare(tx, escrowAccount.advertiserId, hold.amountCents);
  }

  return updatedHold;
}

/**
 * Credit a partner their revenue share when a referred agent generates revenue.
 * Partner gets revenueShareBps basis points of the conversion amount directly.
 * Accepts a transaction client so it runs inside the caller's transaction.
 */
async function creditPartnerRevShare(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  agentId: string,
  conversionAmountCents: number
) {
  const referral = await tx.partnerReferral.findUnique({
    where: { agentId },
    include: { partner: true },
  });

  if (!referral || !referral.partner.active) return;

  // Partner share = revenueShareBps basis points of conversion amount
  const partnerShareCents = Math.round(
    (conversionAmountCents * referral.partner.revenueShareBps) / 10000
  );

  if (partnerShareCents <= 0) return;

  await tx.partner.update({
    where: { id: referral.partnerId },
    data: {
      totalEarnedCents: { increment: partnerShareCents },
      pendingCents: { increment: partnerShareCents },
    },
  });
}

// ---------------------------------------------------------------------------
// Refund Hold
// ---------------------------------------------------------------------------

/**
 * Return held funds back to escrow on lead rejection or dispute.
 * Accepts holds in HELD (rejection) or PENDING_RELEASE (dispute) status.
 * When reversing a PENDING_RELEASE hold, also decrements totalReleasedCents
 * and campaign budgetSpentCents since those were incremented at release time.
 * Double-entry: debit hold, credit escrow.
 */
export async function refundHold(holdId: string) {
  return prisma.$transaction(async (tx) => {
    const hold = await tx.escrowHold.findUnique({
      where: { id: holdId },
      include: { escrowAccount: { select: { campaignId: true } } },
    });

    if (!hold) {
      throw new NotFoundError("EscrowHold", holdId);
    }

    const wasPendingRelease = hold.status === "PENDING_RELEASE";

    if (hold.status !== "HELD" && hold.status !== "PENDING_RELEASE") {
      throw new ValidationError(
        `Hold cannot be refunded from status '${hold.status}'`
      );
    }

    // Update hold status
    const updatedHold = await tx.escrowHold.update({
      where: { id: holdId },
      data: {
        status: "REFUNDED",
        refundedAt: new Date(),
      },
    });

    // Return funds to escrow balance
    const escrowUpdate: Prisma.EscrowAccountUpdateInput = {
      currentBalanceCents: { increment: hold.amountCents },
      totalRefundedCents: { increment: hold.amountCents },
    };

    // Reverse the totalReleasedCents that was incremented when the hold
    // moved to PENDING_RELEASE during releaseHold()
    if (wasPendingRelease) {
      escrowUpdate.totalReleasedCents = { decrement: hold.amountCents };
    }

    await tx.escrowAccount.update({
      where: { id: hold.escrowId },
      data: escrowUpdate,
    });

    // Reverse budgetSpentCents if this was a pending release
    if (wasPendingRelease) {
      await tx.campaign.update({
        where: { id: hold.escrowAccount.campaignId },
        data: {
          budgetSpentCents: { decrement: hold.amountCents },
        },
      });
    }

    // Double-entry ledger
    const transactionId = randomUUID();
    const memo = wasPendingRelease
      ? `Refunded ${hold.amountCents} cents to escrow for disputed lead ${hold.leadId}`
      : `Refunded ${hold.amountCents} cents to escrow for rejected lead ${hold.leadId}`;

    await tx.ledgerEntry.create({
      data: {
        transactionId,
        debitAccountType: "ESCROW",
        debitAccountId: hold.id,
        creditAccountType: "ESCROW",
        creditAccountId: hold.escrowId,
        amountCents: hold.amountCents,
        currency: hold.currency,
        entryType: wasPendingRelease ? "ADJUSTMENT" : "REFUND",
        referenceType: "LEAD",
        referenceId: hold.leadId,
        memo,
      },
    });

    // Emit domain event
    await tx.domainEvent.create({
      data: {
        aggregateType: "EscrowHold",
        aggregateId: holdId,
        eventType: "EscrowRefunded",
        payload: {
          holdId,
          escrowId: hold.escrowId,
          leadId: hold.leadId,
          amountCents: hold.amountCents,
          wasPendingRelease,
        } as unknown as Prisma.InputJsonValue,
        version: 1,
      },
    });

    return updatedHold;
  });
}

// ---------------------------------------------------------------------------
// Get Wallet
// ---------------------------------------------------------------------------

export async function getWallet(agentId: string) {
  const now = new Date();

  // Holds whose releaseAt has passed are economically "available" even if the
  // cron hasn't yet flipped them to RELEASED. Read net-of-fee per-hold to
  // mirror finalizeHoldRelease()'s per-hold Math.ceil rounding exactly.
  const [wallet, maturedHolds, unmaturedAgg] = await Promise.all([
    prisma.wallet.findUnique({
      where: { agentId },
    }),
    prisma.escrowHold.findMany({
      where: {
        affiliateId: agentId,
        status: "PENDING_RELEASE",
        releaseAt: { lte: now },
      },
      select: { amountCents: true },
    }),
    prisma.escrowHold.aggregate({
      where: {
        affiliateId: agentId,
        status: "PENDING_RELEASE",
        releaseAt: { gt: now },
      },
      _sum: { amountCents: true },
      _min: { releaseAt: true },
    }),
  ]);

  if (!wallet) {
    throw new NotFoundError("Wallet for agent", agentId);
  }

  const maturedNetCents = maturedHolds.reduce(
    (sum: number, h: { amountCents: number }) => {
      const fee = Math.ceil(h.amountCents * PLATFORM_FEE_RATE);
      return sum + (h.amountCents - fee);
    },
    0
  );

  const availableCents = wallet.availableCents + maturedNetCents;
  const pendingReleaseCents = unmaturedAgg._sum.amountCents ?? 0;

  return {
    id: wallet.id,
    agentId: wallet.agentId,
    currency: wallet.currency,
    availableCents,
    heldCents: wallet.heldCents,
    pendingPayoutCents: wallet.pendingPayoutCents,
    pendingReleaseCents,
    nextReleaseAt: unmaturedAgg._min.releaseAt ?? null,
    totalCents: availableCents + wallet.heldCents + wallet.pendingPayoutCents,
    status: wallet.status,
    createdAt: wallet.createdAt,
    updatedAt: wallet.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Get Transactions
// ---------------------------------------------------------------------------

export async function getTransactions(
  agentId: string,
  filters: ListTransactionsInput
) {
  // Find the wallet to get the wallet ID
  const wallet = await prisma.wallet.findUnique({
    where: { agentId },
  });

  if (!wallet) {
    throw new NotFoundError("Wallet for agent", agentId);
  }

  const where: Prisma.LedgerEntryWhereInput = {
    OR: [
      { debitAccountId: wallet.id },
      { creditAccountId: wallet.id },
    ],
  };

  if (filters.entryType) {
    where.entryType = filters.entryType;
  }

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) {
      where.createdAt.gte = filters.dateFrom;
    }
    if (filters.dateTo) {
      where.createdAt.lte = filters.dateTo;
    }
  }

  const [entries, totalCount] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where,
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.ledgerEntry.count({ where }),
  ]);

  return {
    transactions: entries,
    totalCount,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

// ---------------------------------------------------------------------------
// Request Payout
// ---------------------------------------------------------------------------

export async function requestPayout(
  affiliateId: string,
  amountCents: number,
  method: "BANK_TRANSFER" | "CRYPTO" | "PLATFORM_CREDIT",
  destination: Record<string, unknown>
) {
  if (amountCents <= 0) {
    throw new ValidationError("Payout amount must be positive");
  }

  if (method === "BANK_TRANSFER" && !ENABLE_STRIPE_WITHDRAWALS()) {
    throw new ValidationError(
      "Bank withdrawals are not currently available. Please use USDC payouts on Base."
    );
  }

  // Validate crypto payout destination
  if (method === "CRYPTO") {
    const chainAddress = destination.chainAddress as string | undefined;
    if (!chainAddress || !/^0x[0-9a-fA-F]{40}$/.test(chainAddress)) {
      throw new ValidationError(
        "CRYPTO payouts require a valid chainAddress in destination (0x-prefixed, 42 chars)"
      );
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({
      where: { agentId: affiliateId },
    });

    if (!wallet) {
      throw new NotFoundError("Wallet for agent", affiliateId);
    }

    if (wallet.status !== "ACTIVE") {
      throw new ValidationError("Wallet is not active");
    }

    if (wallet.availableCents < amountCents) {
      throw new ValidationError(
        `Insufficient available balance: ${wallet.availableCents} cents available, ${amountCents} cents requested`
      );
    }

    // Move funds from available to pendingPayout
    await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        availableCents: { decrement: amountCents },
        pendingPayoutCents: { increment: amountCents },
      },
    });

    // Create payout request
    const payout = await tx.payoutRequest.create({
      data: {
        affiliateId,
        walletId: wallet.id,
        amountCents,
        currency: wallet.currency,
        method,
        destination: destination as Prisma.InputJsonValue,
        status: "PENDING",
      },
    });

    // Double-entry ledger
    const transactionId = randomUUID();

    await tx.ledgerEntry.create({
      data: {
        transactionId,
        debitAccountType: "WALLET",
        debitAccountId: wallet.id,
        creditAccountType: "PLATFORM_RESERVE",
        creditAccountId: payout.id,
        amountCents,
        currency: wallet.currency,
        entryType: "PAYOUT",
        referenceType: "PAYOUT",
        referenceId: payout.id,
        memo: `Payout request ${payout.id} for ${amountCents} cents via ${method}`,
      },
    });

    // Emit domain event
    await tx.domainEvent.create({
      data: {
        aggregateType: "PayoutRequest",
        aggregateId: payout.id,
        eventType: "PayoutRequested",
        payload: {
          payoutId: payout.id,
          affiliateId,
          amountCents,
          method,
        } as unknown as Prisma.InputJsonValue,
        version: 1,
      },
    });

    // PLATFORM_CREDIT: immediately complete — funds stay on platform
    if (method === "PLATFORM_CREDIT") {
      await tx.payoutRequest.update({
        where: { id: payout.id },
        data: {
          status: "COMPLETED",
          processedAt: new Date(),
          completedAt: new Date(),
        },
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          pendingPayoutCents: { decrement: amountCents },
        },
      });

      return { ...payout, status: "COMPLETED" as const };
    }

    return payout;
  });

  notify({
    type: "payout.requested",
    data: {
      affiliateId,
      amountCents,
      method,
      payoutRequestId: result.id,
    },
  });

  if (result.status === "COMPLETED") {
    notify({
      type: "payout.completed",
      data: {
        affiliateId,
        amountCents,
        payoutRequestId: result.id,
      },
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Cancel Payout
// ---------------------------------------------------------------------------

const BANK_WITHDRAWALS_DISABLED_REASON =
  "Bank withdrawals are no longer available. Please request a USDC payout on Base.";

async function cancelPendingPayout(
  payoutId: string,
  opts: {
    affiliateId?: string;
    reason?: string;
    memo: string;
    requireMethod?: "BANK_TRANSFER" | "CRYPTO" | "PLATFORM_CREDIT";
  }
) {
  return prisma.$transaction(async (tx) => {
    const payout = await tx.payoutRequest.findUnique({
      where: { id: payoutId },
    });

    if (!payout) {
      throw new NotFoundError("PayoutRequest", payoutId);
    }

    if (opts.affiliateId && payout.affiliateId !== opts.affiliateId) {
      throw new ForbiddenError("You can only cancel your own payout requests");
    }

    if (opts.requireMethod && payout.method !== opts.requireMethod) {
      throw new ValidationError(
        `Only ${opts.requireMethod} payouts can be cancelled by this path.`
      );
    }

    if (payout.status !== "PENDING") {
      throw new ValidationError(
        `Only PENDING payouts can be cancelled. This payout is ${payout.status}.`
      );
    }

    await tx.wallet.update({
      where: { id: payout.walletId },
      data: {
        availableCents: { increment: payout.amountCents },
        pendingPayoutCents: { decrement: payout.amountCents },
      },
    });

    const cancelled = await tx.payoutRequest.update({
      where: { id: payoutId },
      data: {
        status: "CANCELLED",
        processedAt: new Date(),
        failureReason: opts.reason,
      },
    });

    await tx.ledgerEntry.create({
      data: {
        transactionId: randomUUID(),
        debitAccountType: "PLATFORM_RESERVE",
        debitAccountId: payout.id,
        creditAccountType: "WALLET",
        creditAccountId: payout.walletId,
        amountCents: payout.amountCents,
        currency: payout.currency,
        entryType: "REFUND",
        referenceType: "PAYOUT",
        referenceId: payout.id,
        memo: opts.memo,
      },
    });

    return cancelled;
  });
}

/**
 * Cancel a PENDING payout request and return funds to the affiliate's available balance.
 */
export async function cancelPayout(payoutId: string, affiliateId: string) {
  const result = await cancelPendingPayout(payoutId, {
    affiliateId,
    memo: `Payout request ${payoutId} cancelled by user - funds returned to wallet`,
  });

  notify({
    type: "payout.cancelled",
    data: {
      affiliateId,
      amountCents: result.amountCents,
      payoutRequestId: result.id,
    },
  });

  return result;
}

/**
 * Cancel a legacy pending bank-transfer payout after bank withdrawals are
 * disabled, returning funds so the affiliate can re-request a USDC payout.
 */
export async function cancelBankTransferPayoutForDisabledRail(
  payoutId: string
) {
  const result = await cancelPendingPayout(payoutId, {
    reason: BANK_WITHDRAWALS_DISABLED_REASON,
    memo: `Bank-transfer payout ${payoutId} cancelled because bank withdrawals are disabled - funds returned to wallet`,
    requireMethod: "BANK_TRANSFER",
  });

  notify({
    type: "payout.cancelled",
    data: {
      affiliateId: result.affiliateId,
      amountCents: result.amountCents,
      payoutRequestId: result.id,
      reason: BANK_WITHDRAWALS_DISABLED_REASON,
    },
  });

  return result;
}

// ---------------------------------------------------------------------------
// List Payouts
// ---------------------------------------------------------------------------

export async function listPayouts(
  agentId: string,
  filters: ListPayoutsInput
) {
  const where: Prisma.PayoutRequestWhereInput = {
    affiliateId: agentId,
  };

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.dateFrom || filters.dateTo) {
    where.requestedAt = {};
    if (filters.dateFrom) {
      where.requestedAt.gte = filters.dateFrom;
    }
    if (filters.dateTo) {
      where.requestedAt.lte = filters.dateTo;
    }
  }

  const [payouts, totalCount] = await Promise.all([
    prisma.payoutRequest.findMany({
      where,
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: { requestedAt: "desc" },
    }),
    prisma.payoutRequest.count({ where }),
  ]);

  return {
    payouts,
    totalCount,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

// ---------------------------------------------------------------------------
// Calculate Payout
// ---------------------------------------------------------------------------

/**
 * Calculate the payout amount (in cents) for a conversion.
 *
 * CPL/CPA/CPC: fixed `payoutPerUnitCents`.
 * REV_SHARE:   `revenueCents * payoutPercentage / 100`, rounded to nearest cent.
 *
 * If `lockedPayoutCents` is provided (e.g. from a previously-created Lead where
 * payoutCents was already snapshotted), it takes precedence.
 */
export function calculatePayout(
  campaign: Pick<
    Campaign,
    "compensationModel" | "payoutPerUnitCents" | "payoutPercentage"
  >,
  opts: { revenueCents?: number | null; lockedPayoutCents?: number | null } = {}
): number {
  if (opts.lockedPayoutCents != null) {
    return opts.lockedPayoutCents;
  }
  switch (campaign.compensationModel) {
    case "CPL":
    case "CPA":
    case "CPC":
      if (campaign.payoutPerUnitCents == null) {
        throw new Error(
          `Campaign has compensationModel=${campaign.compensationModel} but no payoutPerUnitCents`
        );
      }
      return campaign.payoutPerUnitCents;
    case "REV_SHARE":
      if (campaign.payoutPercentage == null) {
        throw new Error(
          "REV_SHARE campaign is missing payoutPercentage"
        );
      }
      if (opts.revenueCents == null) {
        throw new Error(
          "REV_SHARE payout requires revenueCents from the postback"
        );
      }
      return Math.round((opts.revenueCents * campaign.payoutPercentage) / 100);
    default:
      throw new Error(
        `Unknown compensationModel: ${campaign.compensationModel}`
      );
  }
}
