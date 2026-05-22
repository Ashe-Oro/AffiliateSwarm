import type { AccountType, LedgerEntryType } from "@/generated/prisma/client";

type WalletLedgerEntry = {
  amountCents: number;
  debitAccountType: AccountType;
  debitAccountId: string | null;
  creditAccountType: AccountType;
  creditAccountId: string | null;
  entryType: LedgerEntryType;
  referenceType: string | null;
};

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";
type Direction = "inflow" | "outflow" | "neutral";

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function entryTouchesWallet(entry: WalletLedgerEntry, walletId: string) {
  return {
    debitsWallet:
      entry.debitAccountType === "WALLET" && entry.debitAccountId === walletId,
    creditsWallet:
      entry.creditAccountType === "WALLET" &&
      entry.creditAccountId === walletId,
  };
}

function isEscrowFundingEntry(entry: WalletLedgerEntry, walletId: string) {
  const { debitsWallet } = entryTouchesWallet(entry, walletId);

  return (
    entry.entryType === "DEPOSIT" &&
    debitsWallet &&
    entry.creditAccountType === "ESCROW"
  );
}

function getWalletDirection(
  entry: WalletLedgerEntry,
  walletId: string
): Direction {
  const { debitsWallet, creditsWallet } = entryTouchesWallet(entry, walletId);

  if (
    entry.entryType === "STRIPE_DEPOSIT" &&
    entry.referenceType === "WALLET" &&
    debitsWallet &&
    creditsWallet
  ) {
    return "inflow";
  }

  if (debitsWallet && !creditsWallet) return "outflow";
  if (creditsWallet && !debitsWallet) return "inflow";
  return "neutral";
}

function getEntryLabel(entry: WalletLedgerEntry, walletId: string): string {
  if (isEscrowFundingEntry(entry, walletId)) {
    return "escrow funding";
  }

  if (entry.entryType === "CHAIN_DEPOSIT") return "onchain deposit";
  if (entry.entryType === "STRIPE_DEPOSIT") return "card deposit";
  if (entry.entryType === "DEPOSIT") return "wallet deposit";
  if (entry.entryType === "ESCROW_RELEASE") return "affiliate earning";
  if (entry.entryType === "ESCROW_HOLD") return "escrow hold";
  if (entry.entryType === "CHAIN_PAYOUT") return "chain payout";

  return entry.entryType.toLowerCase().replace(/_/g, " ");
}

function getReferenceLabel(
  entry: WalletLedgerEntry,
  isEscrowFunding: boolean
): string {
  if (entry.referenceType === "LEAD" && isEscrowFunding) {
    return "lead escrow";
  }

  return entry.referenceType?.toLowerCase().replace(/_/g, " ") ?? "--";
}

function getBadgeVariant(
  entry: WalletLedgerEntry,
  direction: Direction
): BadgeVariant {
  if (entry.entryType === "FEE" || direction === "outflow") return "outline";
  if (entry.entryType === "REFUND") return "destructive";
  if (direction === "inflow") return "default";
  return "secondary";
}

function formatSignedCents(cents: number, direction: Direction): string {
  const formatted = formatCents(cents);
  if (direction === "inflow") return `+${formatted}`;
  if (direction === "outflow") return `-${formatted}`;
  return formatted;
}

export function getWalletLedgerEntryDisplay(
  entry: WalletLedgerEntry,
  walletId: string
) {
  const direction = getWalletDirection(entry, walletId);
  const isEscrowFunding = isEscrowFundingEntry(entry, walletId);
  const label = getEntryLabel(entry, walletId);

  return {
    label,
    referenceLabel: getReferenceLabel(entry, isEscrowFunding),
    amountLabel: formatSignedCents(entry.amountCents, direction),
    amountClassName:
      direction === "inflow"
        ? "text-emerald-600 dark:text-emerald-400"
        : direction === "outflow"
          ? "text-destructive"
          : "",
    badgeVariant: getBadgeVariant(entry, direction),
    direction,
  };
}

export function getAdvertiserWalletTotalCents({
  availableCents,
  campaignEscrowCents,
  affiliateEscrowCents,
}: {
  availableCents: number;
  campaignEscrowCents: number;
  affiliateEscrowCents: number;
}) {
  return availableCents + campaignEscrowCents + affiliateEscrowCents;
}
