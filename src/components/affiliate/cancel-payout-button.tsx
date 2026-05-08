"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface CancelPayoutButtonProps {
  payoutId: string;
}

export function CancelPayoutButton({ payoutId }: CancelPayoutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    if (!confirm("Are you sure you want to cancel this payout?")) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch(
        `/api/dashboard/affiliate/payout/${payoutId}/cancel`,
        { method: "POST" }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message ?? "Failed to cancel payout");
        return;
      }

      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleCancel}
        disabled={loading}
      >
        {loading ? "Cancelling..." : "Cancel"}
      </Button>
      {error && (
        <span className="text-xs text-destructive">{error}</span>
      )}
    </div>
  );
}
