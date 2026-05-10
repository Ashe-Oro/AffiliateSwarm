import { randomUUID } from "crypto";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import {
  ENABLE_STRIPE_DEPOSITS,
  ENABLE_STRIPE_WITHDRAWALS,
} from "@/lib/feature-flags";
import {
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { notify } from "@/services/notification.service";
import type { Prisma } from "@/generated/prisma/client";

const CARD_FEE_RATE = 0.03; // 3% passed to advertiser
const MIN_DEPOSIT_CENTS = 1000; // $10.00

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ---------------------------------------------------------------------------
// Create Checkout Session
// ---------------------------------------------------------------------------

export async function createCheckoutSession(
  agentId: string,
  amountCents: number,
  method: "card" | "ach"
) {
  if (!ENABLE_STRIPE_DEPOSITS()) {
    throw new ValidationError(
      "Card and bank deposits are not currently available. Please deposit USDC on Base."
    );
  }

  if (amountCents < MIN_DEPOSIT_CENTS) {
    throw new ValidationError(
      `Minimum deposit is $${(MIN_DEPOSIT_CENTS / 100).toFixed(2)}`
    );
  }

  // Ensure wallet exists
  const wallet = await prisma.wallet.upsert({
    where: { agentId },
    create: {
      agentId,
      availableCents: 0,
      heldCents: 0,
      pendingPayoutCents: 0,
    },
    update: {},
  });

  if (wallet.status !== "ACTIVE") {
    throw new ValidationError("Wallet is not active");
  }

  // Calculate fees
  const feeCents =
    method === "card" ? Math.ceil(amountCents * CARD_FEE_RATE) : 0;
  const totalChargeCents = amountCents + feeCents;
  const netAmountCents = amountCents; // advertiser always gets full amount

  // Build hosted checkout session.
  const paymentMethodTypes: ("card" | "us_bank_account")[] =
    method === "card" ? ["card"] : ["us_bank_account"];

  const lineItemName =
    method === "card"
      ? `Account deposit ($${(amountCents / 100).toFixed(2)} + $${(feeCents / 100).toFixed(2)} processing fee)`
      : `Account deposit`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: paymentMethodTypes,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: totalChargeCents,
          product_data: {
            name: lineItemName,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      agentId,
      requestedAmountCents: String(amountCents),
      feeCents: String(feeCents),
      netAmountCents: String(netAmountCents),
      paymentMethod: method,
    },
    success_url: `${APP_URL}/dashboard/wallet?deposit=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/dashboard/wallet?deposit=cancelled`,
    ...(method === "ach" && {
      payment_method_options: {
        us_bank_account: {
          financial_connections: { permissions: ["payment_method" as const] },
        },
      },
    }),
  });

  // Store in DB
  const checkout = await prisma.stripeCheckoutSession.create({
    data: {
      walletId: wallet.id,
      agentId,
      stripeSessionId: session.id,
      paymentMethod: method === "card" ? "CARD" : "ACH",
      requestedAmountCents: amountCents,
      feeCents,
      netAmountCents,
      status: "PENDING",
    },
  });

  return { url: session.url, checkoutId: checkout.id };
}

// ---------------------------------------------------------------------------
// Handle Checkout Completed (called from webhook)
// ---------------------------------------------------------------------------

export async function handleCheckoutCompleted(
  stripeSessionId: string,
  paymentStatus: string,
  paymentIntentId: string | null
) {
  const checkout = await prisma.stripeCheckoutSession.findUnique({
    where: { stripeSessionId },
  });

  if (!checkout) return; // not our session

  // Idempotency: already completed
  if (checkout.status === "COMPLETED") return;

  // ACH payments are async — mark as pending payment until funds clear
  if (paymentStatus !== "paid") {
    await prisma.stripeCheckoutSession.update({
      where: { id: checkout.id },
      data: {
        status: "PENDING_PAYMENT",
        stripePaymentIntentId: paymentIntentId,
        stripeStatus: paymentStatus,
      },
    });
    return;
  }

  await creditFromCheckout(checkout.id, paymentIntentId);
}

// ---------------------------------------------------------------------------
// Handle Async Payment Succeeded (ACH clears)
// ---------------------------------------------------------------------------

export async function handleAsyncPaymentSucceeded(
  stripeSessionId: string,
  paymentIntentId: string | null
) {
  const checkout = await prisma.stripeCheckoutSession.findUnique({
    where: { stripeSessionId },
  });

  if (!checkout) return;
  if (checkout.status === "COMPLETED") return;

  await creditFromCheckout(checkout.id, paymentIntentId);
}

// ---------------------------------------------------------------------------
// Handle Async Payment Failed
// ---------------------------------------------------------------------------

export async function handleAsyncPaymentFailed(
  stripeSessionId: string
) {
  await prisma.stripeCheckoutSession.updateMany({
    where: { stripeSessionId, status: { not: "COMPLETED" } },
    data: { status: "FAILED", stripeStatus: "failed" },
  });
}

// ---------------------------------------------------------------------------
// Handle Session Expired
// ---------------------------------------------------------------------------

export async function handleSessionExpired(stripeSessionId: string) {
  await prisma.stripeCheckoutSession.updateMany({
    where: { stripeSessionId, status: { not: "COMPLETED" } },
    data: { status: "EXPIRED", stripeStatus: "expired" },
  });
}

// ---------------------------------------------------------------------------
// Process ACH payout through the card/bank rail.
// ---------------------------------------------------------------------------

export async function processAchPayout(payoutRequestId: string) {
  if (!ENABLE_STRIPE_WITHDRAWALS()) {
    throw new ValidationError(
      "Bank withdrawals are not currently available. Please use USDC payouts on Base."
    );
  }

  const payout = await prisma.payoutRequest.findUnique({
    where: { id: payoutRequestId },
    include: { wallet: true },
  });

  if (!payout) throw new NotFoundError("PayoutRequest", payoutRequestId);
  if (payout.status !== "PENDING") {
    throw new ValidationError(`Payout is already ${payout.status.toLowerCase()}`);
  }
  if (payout.method !== "BANK_TRANSFER") {
    throw new ValidationError("This function only handles BANK_TRANSFER payouts");
  }

  // Mark as processing
  await prisma.payoutRequest.update({
    where: { id: payoutRequestId },
    data: { status: "PROCESSING", processedAt: new Date() },
  });

  notify({
    type: "payout.processing",
    data: {
      payoutRequestId,
      affiliateId: payout.affiliateId,
      amountCents: payout.amountCents,
      method: "BANK_TRANSFER",
    },
  });

  try {
    // Create a transfer to the affiliate through the configured processor.
    const destination = payout.destination as Record<string, unknown>;

    const transfer = await stripe.transfers.create({
      amount: payout.amountCents,
      currency: "usd",
      destination: destination.stripeAccountId as string,
      description: `AffiliateSwarm affiliate payout ${payout.id}`,
      metadata: {
        payoutRequestId: payout.id,
        affiliateId: payout.affiliateId,
      },
    });

    // Mark completed
    await prisma.$transaction(async (tx) => {
      await tx.payoutRequest.update({
        where: { id: payoutRequestId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      // Move from pending payout to zero
      await tx.wallet.update({
        where: { id: payout.walletId },
        data: {
          pendingPayoutCents: { decrement: payout.amountCents },
        },
      });

      // Ledger entry
      await tx.ledgerEntry.create({
        data: {
          transactionId: randomUUID(),
          debitAccountType: "PLATFORM_RESERVE",
          debitAccountId: payout.id,
          creditAccountType: "WALLET",
          creditAccountId: payout.walletId,
          amountCents: payout.amountCents,
          currency: payout.currency,
          entryType: "PAYOUT",
          referenceType: "PAYOUT",
          referenceId: payout.id,
          memo: `ACH payout completed - processor transfer ${transfer.id}`,
        },
      });
    });

    notify({
      type: "payout.completed",
      data: {
        payoutRequestId,
        affiliateId: payout.affiliateId,
        amountCents: payout.amountCents,
      },
    });

    return { success: true, transferId: transfer.id };
  } catch (err: unknown) {
    const failureReason = err instanceof Error ? err.message : "Unknown error";
    // Mark failed
    await prisma.payoutRequest.update({
      where: { id: payoutRequestId },
      data: {
        status: "FAILED",
        failureReason,
      },
    });

    // Refund pending payout back to available
    await prisma.wallet.update({
      where: { id: payout.walletId },
      data: {
        availableCents: { increment: payout.amountCents },
        pendingPayoutCents: { decrement: payout.amountCents },
      },
    });

    notify({
      type: "payout.failed",
      data: {
        payoutRequestId,
        affiliateId: payout.affiliateId,
        amountCents: payout.amountCents,
        reason: failureReason,
      },
    });

    return { success: false, error: failureReason };
  }
}

// ---------------------------------------------------------------------------
// Internal: Credit wallet/escrow from a completed checkout
// ---------------------------------------------------------------------------

export async function creditFromCheckout(
  checkoutId: string,
  paymentIntentId: string | null
) {
  const txResult = await prisma.$transaction(async (tx) => {
    const checkout = await tx.stripeCheckoutSession.findUnique({
      where: { id: checkoutId },
    });

    if (!checkout || checkout.status === "COMPLETED") return null;

    const wallet = await tx.wallet.findUnique({
      where: { id: checkout.walletId },
    });

    if (!wallet) return null;

    // Credit the advertiser's wallet (funds available for campaign allocation)
    await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        availableCents: { increment: checkout.netAmountCents },
      },
    });

    // Legacy: older checkouts may have a campaignId for auto-escrow allocation.
    // New checkouts always deposit to the wallet without a campaign target.
    let escrowId: string | null = null;
    if (checkout.campaignId) {
      const escrow = await tx.escrowAccount.findUnique({
        where: { campaignId: checkout.campaignId },
      });

      if (escrow) {
        escrowId = escrow.id;
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            availableCents: { decrement: checkout.netAmountCents },
          },
        });

        await tx.escrowAccount.update({
          where: { id: escrow.id },
          data: {
            totalDepositedCents: { increment: checkout.netAmountCents },
            currentBalanceCents: { increment: checkout.netAmountCents },
          },
        });
      }
    }

    // Double-entry ledger: deposit to wallet
    const depositTxId = randomUUID();
    await tx.ledgerEntry.create({
      data: {
        transactionId: depositTxId,
        debitAccountType: "WALLET",
        debitAccountId: wallet.id,
        creditAccountType: escrowId ? "ESCROW" : "WALLET",
        creditAccountId: escrowId ?? wallet.id,
        amountCents: checkout.netAmountCents,
        currency: wallet.currency,
        entryType: "STRIPE_DEPOSIT",
        referenceType: checkout.campaignId ? "CAMPAIGN" : "WALLET",
        referenceId: checkout.campaignId ?? wallet.id,
        memo: `${checkout.paymentMethod === "CARD" ? "Card" : "Bank"} deposit of $${(checkout.netAmountCents / 100).toFixed(2)}${checkout.campaignId ? ` for campaign` : ` to account`}`,
      },
    });

    // If card fee, record fee ledger entry
    if (checkout.feeCents > 0) {
      await tx.ledgerEntry.create({
        data: {
          transactionId: randomUUID(),
          debitAccountType: "WALLET",
          debitAccountId: wallet.id,
          creditAccountType: "PLATFORM_REVENUE",
          creditAccountId: wallet.id,
          amountCents: checkout.feeCents,
          currency: wallet.currency,
          entryType: "FEE",
          referenceType: checkout.campaignId ? "CAMPAIGN" : "WALLET",
          referenceId: checkout.campaignId ?? wallet.id,
          memo: `Processing fee (${checkout.paymentMethod === "CARD" ? "3%" : "ACH"}) on $${(checkout.requestedAmountCents / 100).toFixed(2)} deposit`,
        },
      });
    }

    // Update checkout status
    await tx.stripeCheckoutSession.update({
      where: { id: checkout.id },
      data: {
        status: "COMPLETED",
        stripePaymentIntentId: paymentIntentId,
        stripeStatus: "paid",
        completedAt: new Date(),
      },
    });

    // Advance account gate: PENDING → FUNDED on first deposit
    await tx.agent.updateMany({
      where: { id: checkout.agentId, accountGate: "PENDING" },
      data: { accountGate: "FUNDED" },
    });

    // Emit domain event
    await tx.domainEvent.create({
      data: {
        aggregateType: "Wallet",
        aggregateId: wallet.id,
        eventType: "StripeDepositCompleted",
        payload: {
          checkoutId: checkout.id,
          campaignId: checkout.campaignId,
          agentId: checkout.agentId,
          netAmountCents: checkout.netAmountCents,
          feeCents: checkout.feeCents,
          paymentMethod: checkout.paymentMethod,
        } as unknown as Prisma.InputJsonValue,
        version: 1,
      },
    });

    return {
      agentId: checkout.agentId,
      campaignId: checkout.campaignId,
      netAmountCents: checkout.netAmountCents,
      paymentMethod: checkout.paymentMethod,
    };
  });

  // Fire campaign.funded notification if a campaign was specified
  if (txResult?.campaignId) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: txResult.campaignId },
      select: { name: true },
    });
    notify({
      type: "campaign.funded",
      data: {
        campaignId: txResult.campaignId,
        campaignName: campaign?.name ?? "",
        advertiserId: txResult.agentId,
        amountCents: txResult.netAmountCents,
        source: txResult.paymentMethod === "CARD" ? "stripe_card" : "stripe_ach",
      },
    });
  }
}
