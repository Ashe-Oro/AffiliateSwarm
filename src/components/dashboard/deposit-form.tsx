"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DepositFormProps {
  depositAddress: string | null;
  enableBankTransfer?: boolean;
}

type DepositMethod = "crypto" | "card" | "ach";

const CARD_FEE_RATE = 0.03;
const MIN_DEPOSIT_DOLLARS = 10;

function getCheckoutButtonLabel(
  method: DepositMethod,
  totalCents: number,
  amountCents: number
): string {
  if (method === "card") {
    return `Deposit $${(totalCents / 100).toFixed(2)} with Card`;
  }
  return `Deposit $${(amountCents / 100).toFixed(2)} with Bank Transfer`;
}

export function DepositForm({ depositAddress, enableBankTransfer = false }: DepositFormProps) {
  const router = useRouter();
  const [method, setMethod] = useState<DepositMethod>("card");
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const amountCents = Math.round(parseFloat(amount || "0") * 100);
  const feeCents =
    method === "card" ? Math.ceil(amountCents * CARD_FEE_RATE) : 0;
  const totalCents = amountCents + feeCents;

  async function handleCryptoVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!txHash) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/dashboard/wallet/verify-deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message ?? "Failed to verify deposit");
      }

      const cents = data.data?.amountCents ?? 0;
      const dollars = (cents / 100).toFixed(2);
      setSuccess(
        data.data?.alreadyProcessed
          ? `This deposit was already processed ($${dollars}).`
          : `Deposit verified! $${dollars} added to your wallet.`
      );
      setTxHash("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleStripeCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (amountCents < MIN_DEPOSIT_DOLLARS * 100) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/dashboard/wallet/stripe-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents,
          paymentMethod: method,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message ?? "Failed to create checkout");
      }

      // Redirect to Stripe Checkout
      window.location.href = data.data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  const methods: { key: DepositMethod; label: string; desc: string }[] = [
    { key: "card", label: "Credit Card", desc: "Instant, 3% fee" },
    ...(enableBankTransfer
      ? [{ key: "ach" as const, label: "Bank Transfer", desc: "3-5 days, no fee" }]
      : []),
    { key: "crypto", label: "Crypto (USDC)", desc: "Instant, On Base chain" },
  ];

  return (
    <div className="space-y-6">
      {/* Method selector */}
      <div className="grid gap-3 sm:grid-cols-3">
        {methods.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => {
              setMethod(m.key);
              setError(null);
              setSuccess(null);
            }}
            className={`rounded-lg border p-3 text-left transition-colors ${
              method === m.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:border-border/80"
            }`}
          >
            <span className="text-sm font-medium">{m.label}</span>
            <span
              className={`mt-0.5 block text-xs ${
                method === m.key
                  ? "text-primary-foreground/70"
                  : "text-muted-foreground"
              }`}
            >
              {m.desc}
            </span>
          </button>
        ))}
      </div>

      {/* Crypto form */}
      {method === "crypto" && (
        <>
          {!depositAddress ? (
            <p className="text-sm text-muted-foreground">
              Your wallet is being initialized. Refresh the page in a moment.
            </p>
          ) : (
            <>
              <div className="rounded-lg border border-border bg-muted p-4">
                <p className="text-sm font-medium text-foreground">
                  Send USDC on Base to this address
                </p>
                <div className="mt-2 rounded-md bg-background px-4 py-3">
                  <code className="break-all font-mono text-sm text-muted-foreground">
                    {depositAddress}
                  </code>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Only send USDC on Base chain (chain ID 8453). Other tokens or
                  chains will be lost.
                </p>
              </div>

              <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  Deposits are detected automatically
                </p>
                <p className="mt-1 text-xs text-green-700 dark:text-green-300">
                  After sending USDC to the address above, your wallet will be
                  credited automatically within a few minutes once confirmed on
                  Base.
                </p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowManual(!showManual)}
                  className="text-xs text-muted-foreground underline hover:text-foreground"
                >
                  {showManual
                    ? "Hide manual verification"
                    : "Have a transaction hash? Verify manually"}
                </button>
                {showManual && (
                  <form onSubmit={handleCryptoVerify} className="mt-3 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="deposit-txhash">Transaction hash</Label>
                      <Input
                        id="deposit-txhash"
                        type="text"
                        placeholder="0x..."
                        value={txHash}
                        onChange={(e) => setTxHash(e.target.value)}
                        required
                        pattern="^0x[0-9a-fA-F]{64}$"
                        title="Must be a 66-character hex transaction hash (0x...)"
                      />
                    </div>
                    <Button type="submit" variant="outline" disabled={loading}>
                      {loading ? "Verifying..." : "Verify Deposit"}
                    </Button>
                  </form>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Card / ACH form */}
      {(method === "card" || method === "ach") && (
        <form onSubmit={handleStripeCheckout} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deposit-amount">Amount (USD)</Label>
            <Input
              id="deposit-amount"
              type="number"
              placeholder="100.00"
              min={MIN_DEPOSIT_DOLLARS}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Minimum deposit: ${MIN_DEPOSIT_DOLLARS.toFixed(2)}
            </p>
          </div>

          {/* Fee breakdown */}
          {amountCents >= MIN_DEPOSIT_DOLLARS * 100 && (
            <div className="rounded-lg border border-border bg-muted p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Deposit amount</span>
                <span>${(amountCents / 100).toFixed(2)}</span>
              </div>
              {method === "card" && feeCents > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Processing fee (3%)</span>
                  <span>${(feeCents / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="mt-1 flex justify-between border-t border-border pt-1 font-medium">
                <span>Total charge</span>
                <span>${(totalCents / 100).toFixed(2)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                ${(amountCents / 100).toFixed(2)} will be added to your wallet.
              </p>
            </div>
          )}

          {method === "ach" && (
            <p className="text-xs text-muted-foreground">
              ACH bank transfers typically take 3-5 business days to clear. Your
              wallet will be credited once the payment is confirmed.
            </p>
          )}

          <Button
            type="submit"
            disabled={loading || amountCents < MIN_DEPOSIT_DOLLARS * 100}
          >
            {loading
              ? "Redirecting..."
              : getCheckoutButtonLabel(method, totalCents, amountCents)}
          </Button>
        </form>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}
    </div>
  );
}
