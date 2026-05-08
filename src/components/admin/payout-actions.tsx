"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface AdminPayoutActionsProps {
  payoutId: string;
  method: string;
}

export function AdminPayoutActions({ payoutId, method }: AdminPayoutActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleAction(action: "PROCESS" | "REJECT") {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payoutId, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? "Failed"
        );
      } else {
        setResult(data.status ?? "Done");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button size="sm" disabled={loading} onClick={() => handleAction("PROCESS")}>
        Process
      </Button>
      <Button
        variant="destructive"
        size="sm"
        disabled={loading}
        onClick={() => handleAction("REJECT")}
      >
        Reject
      </Button>
      {result && (
        <span className="text-xs text-muted-foreground ml-1">{result}</span>
      )}
    </div>
  );
}
