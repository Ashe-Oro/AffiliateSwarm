"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface RequestPayoutFormProps {
  availableCents: number;
  walletChainAddress: string | null;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function RequestPayoutForm({
  availableCents,
  walletChainAddress,
}: RequestPayoutFormProps) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [chainAddress, setChainAddress] = useState(walletChainAddress ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const amountCents = Math.round(parseFloat(amount || "0") * 100);
  const canSubmit =
    amountCents >= 100 &&
    amountCents <= availableCents &&
    /^0x[0-9a-fA-F]{40}$/.test(chainAddress);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/dashboard/affiliate/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents,
          method: "CRYPTO",
          destination: { chainAddress },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message ?? "Failed to request payout");
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950">
        <div className="flex items-center gap-2">
          <Badge variant="default">pending</Badge>
          <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
            Payout request submitted
          </span>
        </div>
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          Your USDC payout of {formatCents(amountCents)} is being processed.
          You can track its status on the Earnings page.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSuccess(false);
            setAmount("");
          }}
        >
          Request another payout
        </Button>
      </div>
    );
  }

  if (availableCents < 100) {
    return (
      <p className="text-sm text-muted-foreground">
        You need at least $1.00 in available balance to request a payout.
        Current balance: {formatCents(availableCents)}.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Available:</span>
        <span className="font-semibold">{formatCents(availableCents)}</span>
      </div>

      {/* Payout method — USDC on Base is the only supported payout rail. */}
      <div className="space-y-1.5">
        <Label htmlFor="chainAddress">
          Receiving Address (USDC on Base)
        </Label>
        <Input
          id="chainAddress"
          placeholder="0x..."
          value={chainAddress}
          onChange={(e) => setChainAddress(e.target.value.trim())}
          className="font-mono text-sm"
        />
        {chainAddress && !/^0x[0-9a-fA-F]{40}$/.test(chainAddress) && (
          <p className="text-xs text-destructive">
            Enter a valid Ethereum address (0x + 40 hex characters)
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Payouts are sent as USDC on Base. Make sure this address is on Base
          and can receive USDC.
        </p>
      </div>

      {/* Amount */}
      <div className="space-y-1.5">
        <Label htmlFor="amount">Amount (USD)</Label>
        <div className="flex items-center gap-2">
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="1.00"
            max={(availableCents / 100).toFixed(2)}
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAmount((availableCents / 100).toFixed(2))}
          >
            Max
          </Button>
        </div>
        {amountCents > 0 && amountCents < 100 && (
          <p className="text-xs text-destructive">Minimum payout is $1.00</p>
        )}
        {amountCents > availableCents && (
          <p className="text-xs text-destructive">
            You can only withdraw cleared commissions. Your current available
            balance is {formatCents(availableCents)}. Some earnings may still be
            within the holding period.
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button type="submit" disabled={!canSubmit || loading}>
        {loading ? "Submitting..." : "Request Payout"}
      </Button>
    </form>
  );
}
