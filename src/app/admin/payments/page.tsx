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
import { prisma } from "@/lib/prisma";
import { AdminPayoutActions } from "@/components/admin/payout-actions";
import { CopyButton } from "@/components/ui/copy-button";
import { txUrl, addressUrl } from "@/lib/chain/explorer";
import { CHAIN_NETWORK } from "@/lib/chain/config";
import { formatCents } from "@/lib/utils";

function statusVariant(entryType: string) {
  switch (entryType) {
    case "ESCROW_RELEASE":
    case "PAYOUT":
    case "CHAIN_PAYOUT":
      return "default" as const;
    case "REFUND":
      return "destructive" as const;
    case "FEE":
      return "secondary" as const;
    default:
      return "secondary" as const;
  }
}

function shortHash(hash: string | null | undefined): string {
  if (!hash) return "—";
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

async function getPlatformHotWalletInfo(): Promise<{
  address: string;
  usdcCents: number;
  ethWei: string;
  error: string | null;
} | null> {
  try {
    const { getPlatformAccount } = await import("@/lib/chain/wallet");
    const { getUsdcBalance, usdcToCents } = await import("@/lib/chain/usdc");
    const { getPublicClient } = await import("@/lib/chain/config");

    const platform = await getPlatformAccount();
    const [usdc, eth] = await Promise.all([
      getUsdcBalance(platform.address),
      getPublicClient().getBalance({ address: platform.address }),
    ]);

    return {
      address: platform.address,
      usdcCents: usdcToCents(usdc),
      ethWei: eth.toString(),
      error: null,
    };
  } catch (err) {
    return {
      address: "",
      usdcCents: 0,
      ethWei: "0",
      error: err instanceof Error ? err.message : "Unknown chain read error",
    };
  }
}

export default async function PaymentsPage() {
  const [
    escrowAgg,
    pendingPayouts,
    completedPayouts,
    transactions,
    platformFeeAgg,
    chainTxs,
    hotWallet,
  ] = await Promise.all([
    prisma.escrowAccount.aggregate({
      _sum: {
        currentBalanceCents: true,
        totalReleasedCents: true,
      },
    }),
    prisma.payoutRequest.findMany({
      where: { status: "PENDING" },
      include: {
        affiliate: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: { requestedAt: "asc" },
      take: 50,
    }),
    prisma.payoutRequest.findMany({
      where: { status: { in: ["COMPLETED", "FAILED"] } },
      include: {
        affiliate: { select: { id: true, displayName: true } },
        chainTransaction: { select: { txHash: true } },
      },
      orderBy: { completedAt: "desc" },
      take: 20,
    }),
    prisma.ledgerEntry.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.ledgerEntry.aggregate({
      where: { entryType: "FEE", creditAccountType: "PLATFORM_REVENUE" },
      _sum: { amountCents: true },
    }),
    prisma.chainTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        wallet: { select: { agent: { select: { displayName: true } } } },
      },
    }),
    getPlatformHotWalletInfo(),
  ]);

  const pendingPayoutsAgg = await prisma.payoutRequest.aggregate({
    where: { status: "PENDING" },
    _sum: { amountCents: true },
    _count: true,
  });

  const totalEscrowed = escrowAgg._sum.currentBalanceCents ?? 0;
  const totalReleased = escrowAgg._sum.totalReleasedCents ?? 0;
  const platformRevenue = platformFeeAgg._sum.amountCents ?? 0;
  const pendingPayoutsCents = pendingPayoutsAgg._sum.amountCents ?? 0;
  const pendingPayoutsCount = pendingPayoutsAgg._count;

  const summaryCards = [
    {
      title: "Total Escrowed",
      value: formatCents(totalEscrowed),
      description: "Current escrow balances",
    },
    {
      title: "Total Released",
      value: formatCents(totalReleased),
      description: "Gross — affiliate payouts + platform fees",
    },
    {
      title: "Platform Revenue",
      value: formatCents(platformRevenue),
      description: "Cumulative 5% fees on verified conversions",
    },
    {
      title: "Pending Payouts",
      value: formatCents(pendingPayoutsCents),
      description: `${pendingPayoutsCount} request${pendingPayoutsCount === 1 ? "" : "s"} pending`,
    },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Payments</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
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

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>
            Platform Hot Wallet ({CHAIN_NETWORK})
          </CardDescription>
          <CardTitle className="text-xl">
            {hotWallet?.error
              ? "Unavailable"
              : formatCents(hotWallet?.usdcCents ?? 0) + " USDC"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hotWallet?.error ? (
            <p className="text-xs text-destructive">{hotWallet.error}</p>
          ) : (
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span>Address:</span>
                <a
                  href={addressUrl(hotWallet!.address)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono underline"
                  title={hotWallet!.address}
                >
                  {shortHash(hotWallet!.address)}
                </a>
                <CopyButton
                  text={hotWallet!.address}
                  variant="ghost"
                  size="icon-xs"
                  label=""
                  copiedLabel=""
                  className="h-5 w-5 p-0"
                />
              </div>
              <p>
                Gas:{" "}
                {(Number(BigInt(hotWallet!.ethWei)) / 1e18).toFixed(6)} ETH
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {pendingPayouts.length > 0 && (
        <div>
          <h3 className="mb-3 text-lg font-semibold">Pending Payouts</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Affiliate</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingPayouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {payout.affiliate.displayName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {payout.affiliate.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {payout.method.toLowerCase().replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCents(payout.amountCents)}
                    </TableCell>
                    <TableCell>
                      {payout.requestedAt.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      <AdminPayoutActions
                        payoutId={payout.id}
                        method={payout.method}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-3 text-lg font-semibold">Recent Completed / Failed Payouts</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Affiliate</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Tx</TableHead>
                <TableHead>Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completedPayouts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No completed payouts yet
                  </TableCell>
                </TableRow>
              ) : (
                completedPayouts.map((p) => {
                  const hash = p.chainTransaction?.txHash;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {p.affiliate.displayName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {p.method.toLowerCase().replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={p.status === "COMPLETED" ? "default" : "destructive"}
                        >
                          {p.status.toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCents(p.amountCents)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {hash ? (
                          <a
                            href={txUrl(hash)}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            {shortHash(hash)}
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.completedAt?.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }) ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-lg font-semibold">Recent Onchain Transactions</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Direction</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Tx</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chainTxs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No onchain transactions yet
                  </TableCell>
                </TableRow>
              ) : (
                chainTxs.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {tx.direction.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {tx.wallet?.agent?.displayName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          tx.status === "CONFIRMED"
                            ? "default"
                            : tx.status === "FAILED"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {tx.status.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCents(tx.amountCents)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {tx.txHash ? (
                        <a
                          href={txUrl(tx.txHash)}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          {shortHash(tx.txHash)}
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {tx.createdAt.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-lg font-semibold">Recent Ledger Entries</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No transactions found
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-mono text-sm">
                      {tx.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(tx.entryType)}>
                        {tx.entryType.toLowerCase().replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCents(tx.amountCents)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {tx.referenceType?.toLowerCase() ?? "—"}
                    </TableCell>
                    <TableCell>
                      {tx.createdAt.toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
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
