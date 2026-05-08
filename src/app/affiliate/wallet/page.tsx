export const dynamic = "force-dynamic";

import Link from "next/link";
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
import { prisma } from "@/lib/prisma";
import { requireAffiliateDashboardAuth } from "@/lib/auth/affiliate-dashboard";
import { RequestPayoutForm } from "@/components/affiliate/request-payout-form";
import { CancelPayoutButton } from "@/components/affiliate/cancel-payout-button";

const CHAIN_EXPLORER = "https://basescan.org/tx/";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "--";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function entryTypeVariant(entryType: string) {
  switch (entryType) {
    case "ESCROW_RELEASE":
    case "PAYOUT":
    case "CHAIN_PAYOUT":
      return "default" as const;
    case "DEPOSIT":
    case "CHAIN_DEPOSIT":
    case "STRIPE_DEPOSIT":
      return "secondary" as const;
    case "REFUND":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

function payoutStatusVariant(status: string) {
  switch (status) {
    case "COMPLETED":
      return "default" as const;
    case "FAILED":
      return "destructive" as const;
    case "CANCELLED":
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

function maskChainAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function destinationLabel(method: string, destination: unknown): string {
  if (!destination || typeof destination !== "object") return "--";
  const d = destination as Record<string, unknown>;
  if (method === "CRYPTO" && typeof d.chainAddress === "string") {
    return maskChainAddress(d.chainAddress);
  }
  if (method === "BANK_TRANSFER") {
    if (typeof d.last4 === "string") return `•••• ${d.last4}`;
    if (typeof d.accountLast4 === "string") return `•••• ${d.accountLast4}`;
    return "bank account";
  }
  return "--";
}

export default async function AffiliateWalletPage() {
  const { agent } = await requireAffiliateDashboardAuth();
  const agentId = agent.id;

  const wallet = await prisma.wallet.findUnique({ where: { agentId } });

  // Lifetime earnings (sum of verified lead payouts)
  const lifetimeAgg = await prisma.lead.aggregate({
    where: { affiliateId: agentId, status: "VERIFIED" },
    _sum: { payoutCents: true },
  });

  const [transactions, payouts] = await Promise.all([
    wallet
      ? prisma.ledgerEntry.findMany({
          where: {
            OR: [
              { creditAccountId: wallet.id },
              { debitAccountId: wallet.id },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
    prisma.payoutRequest.findMany({
      where: { affiliateId: agentId },
      orderBy: { requestedAt: "desc" },
      take: 20,
      include: {
        chainTransaction: { select: { txHash: true } },
      },
    }),
  ]);

  const available = wallet?.availableCents ?? 0;
  const pendingPayout = wallet?.pendingPayoutCents ?? 0;
  const lifetime = lifetimeAgg._sum.payoutCents ?? 0;

  const balanceCards = [
    {
      title: "Available",
      value: formatCents(available),
      description: "Ready for withdrawal",
    },
    {
      title: "Pending Withdrawal",
      value: formatCents(pendingPayout),
      description:
        pendingPayout > 0
          ? "Locked until your payout request is processed or cancelled"
          : "No payouts in flight",
    },
    {
      title: "Lifetime Earnings",
      value: formatCents(lifetime),
      description: "Total verified earnings",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Wallet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your affiliate earnings and payout details.
        </p>
      </div>

      {/* Balance cards */}
      <div className="grid gap-4 sm:grid-cols-3">
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
              <div>
                <dt className="text-muted-foreground">Network</dt>
                <dd className="mt-0.5 font-medium">Base (USDC)</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Request payout */}
      <Card>
        <CardHeader>
          <CardTitle>Request Payout</CardTitle>
          <CardDescription>
            Withdraw your available earnings as USDC on Base. Payouts are
            processed every few minutes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RequestPayoutForm
            availableCents={available}
            walletChainAddress={wallet?.chainAddress ?? null}
          />
        </CardContent>
      </Card>

      {/* Payout requests */}
      <div>
        <h3 className="mb-3 text-lg font-semibold">Payout Requests</h3>
        <p className="mb-3 text-sm text-muted-foreground">
          Your withdrawal requests and their status. Cancel any pending
          request to return funds to Available.
        </p>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Tx / Reason</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-muted-foreground"
                  >
                    No payout requests yet.
                  </TableCell>
                </TableRow>
              ) : (
                payouts.map((payout) => {
                  const txHash = payout.chainTransaction?.txHash;
                  return (
                    <TableRow key={payout.id}>
                      <TableCell className="text-right font-medium">
                        {formatCents(payout.amountCents)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {payout.method.toLowerCase().replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {destinationLabel(payout.method, payout.destination)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={payoutStatusVariant(payout.status)}>
                          {payout.status.toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(payout.requestedAt)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(payout.completedAt)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs">
                        {txHash ? (
                          <Link
                            href={`${CHAIN_EXPLORER}${txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-primary hover:underline"
                          >
                            {maskChainAddress(txHash)}
                          </Link>
                        ) : payout.status === "FAILED" ? (
                          <span className="text-destructive" title={payout.failureReason ?? undefined}>
                            {payout.failureReason ?? "Failed"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {payout.status === "PENDING" && (
                          <CancelPayoutButton payoutId={payout.id} />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Ledger transactions */}
      <div>
        <h3 className="mb-3 text-lg font-semibold">Recent Ledger Activity</h3>
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
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    No transactions yet.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      <Badge variant={entryTypeVariant(tx.entryType)}>
                        {tx.entryType.toLowerCase().replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCents(tx.amountCents)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {tx.referenceType?.toLowerCase() ?? "--"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                      {tx.memo ?? "--"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(tx.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
