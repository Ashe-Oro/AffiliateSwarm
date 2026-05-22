export const dynamic = "force-dynamic";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireDashboardAuth } from "@/lib/auth/dashboard";
import {
  ENABLE_BANK_TRANSFER,
  ENABLE_STRIPE_DEPOSITS,
} from "@/lib/feature-flags";
import { DepositForm } from "@/components/dashboard/deposit-form";
import { DepositStatusBanner } from "@/components/dashboard/deposit-status-banner";
import {
  formatCents,
  getAdvertiserWalletTotalCents,
  getWalletLedgerEntryDisplay,
} from "./ledger-display";

export default async function DashboardWalletPage() {
  const { advertiserAgent } = await requireDashboardAuth();
  const agentId = advertiserAgent.id;

  if (!agentId) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Wallet</h2>
        <p className="text-muted-foreground">No agent found.</p>
      </div>
    );
  }

  const [wallet, escrowAgg, activeEscrowHoldAgg] = await Promise.all([
    prisma.wallet.findUnique({ where: { agentId } }),
    prisma.escrowAccount.aggregate({
      where: { advertiserId: agentId },
      _sum: { currentBalanceCents: true, totalReleasedCents: true },
    }),
    prisma.escrowHold.aggregate({
      where: {
        status: { in: ["HELD", "PENDING_RELEASE"] },
        escrowAccount: { advertiserId: agentId },
      },
      _sum: { amountCents: true },
    }),
  ]);

  const transactions = wallet
    ? await prisma.ledgerEntry.findMany({
        where: {
          OR: [
            { debitAccountType: "WALLET", debitAccountId: wallet.id },
            { creditAccountType: "WALLET", creditAccountId: wallet.id },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : [];

  const campaignEscrow = escrowAgg._sum.currentBalanceCents ?? 0;
  const affiliateEscrow = activeEscrowHoldAgg._sum.amountCents ?? 0;
  const committedSpend = escrowAgg._sum.totalReleasedCents ?? 0;
  const available = wallet?.availableCents ?? 0;
  const walletId = wallet?.id;
  const total = getAdvertiserWalletTotalCents({
    availableCents: available,
    campaignEscrowCents: campaignEscrow,
    affiliateEscrowCents: affiliateEscrow,
  });
  const enableStripeDeposits = ENABLE_STRIPE_DEPOSITS();
  const enableBankTransfer = enableStripeDeposits && ENABLE_BANK_TRANSFER();

  const balanceCards = [
    {
      title: "Available",
      value: formatCents(available),
      description: "Ready to fund campaigns",
    },
    {
      title: "Campaign Escrow",
      value: formatCents(campaignEscrow),
      description: "Allocated to campaigns, not yet tied to conversions",
    },
    {
      title: "Affiliate Escrow",
      value: formatCents(affiliateEscrow),
      description: "Held for pending or verified conversions",
    },
    {
      title: "Committed Spend",
      value: formatCents(committedSpend),
      description: "Verified payouts, including pending release",
    },
    {
      title: "Total On Platform",
      value: formatCents(total),
      description: "Available wallet funds plus active escrow",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Wallet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add funds with USDC on Base. Then allocate to your campaigns.
        </p>
      </div>

      <Suspense>
        <DepositStatusBanner />
      </Suspense>

      {/* Balance cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {balanceCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <CardDescription>{card.title}</CardDescription>
              <CardTitle className="text-3xl">{card.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle>Add Funds</CardTitle>
          <CardDescription>
            {enableBankTransfer
              ? "Choose a payment method to add funds to your wallet. Card payments are instant (3% fee), ACH takes 3-5 days (no fee), and crypto deposits are verified onchain."
              : enableStripeDeposits
                ? "Choose a payment method to add funds to your wallet. Card payments are instant (3% fee), and crypto deposits are verified onchain."
                : "Send USDC on Base to add funds to your wallet. Deposits are detected automatically once confirmed onchain."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DepositForm
            depositAddress={wallet?.depositAddress ?? null}
            enableStripeDeposits={enableStripeDeposits}
            enableBankTransfer={enableBankTransfer}
          />
        </CardContent>
      </Card>

      {/* Wallet details */}
      {wallet && (wallet.walletType || wallet.chainAddress) && (
        <Card>
          <CardHeader>
            <CardTitle>Wallet Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
              {wallet.walletType && (
                <div>
                  <dt className="text-muted-foreground">Type</dt>
                  <dd className="mt-0.5 font-medium">
                    {wallet.walletType === "CUSTODIAL"
                      ? "Custodial (platform-managed)"
                      : "BYOW (your own wallet)"}
                  </dd>
                </div>
              )}
              {wallet.chainAddress && (
                <div>
                  <dt className="text-muted-foreground">Chain Address</dt>
                  <dd className="mt-0.5 break-all font-mono text-xs">
                    {wallet.chainAddress}
                  </dd>
                </div>
              )}
              {wallet.depositAddress && (
                <div>
                  <dt className="text-muted-foreground">Deposit Address</dt>
                  <dd className="mt-0.5 break-all font-mono text-xs">
                    {wallet.depositAddress}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-muted-foreground">Network</dt>
                <dd className="mt-0.5 font-medium">Base (USDC)</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Transactions */}
      <div>
        <h3 className="mb-3 text-lg font-semibold">Recent Transactions</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Memo</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 || !walletId ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    No transactions yet. Fund a campaign to get started.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => {
                  const display = getWalletLedgerEntryDisplay(tx, walletId);

                  return (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <Badge variant={display.badgeVariant}>
                          {display.label}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${display.amountClassName}`}
                      >
                        {display.amountLabel}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {display.referenceLabel}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                        {tx.memo ?? "--"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {tx.createdAt.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
