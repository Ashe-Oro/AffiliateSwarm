"use client";

import { useSearchParams } from "next/navigation";

export function DepositStatusBanner() {
  const searchParams = useSearchParams();
  const deposit = searchParams.get("deposit");

  if (deposit === "success") {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
        Payment submitted successfully. Your campaign will be credited once the
        payment is confirmed.
      </div>
    );
  }

  if (deposit === "cancelled") {
    return (
      <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
        Payment was cancelled. No charges were made.
      </div>
    );
  }

  return null;
}
