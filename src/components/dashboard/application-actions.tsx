"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface ApplicationActionsProps {
  campaignId: string;
  applicationId: string;
  status: string;
}

export function ApplicationActions({
  campaignId,
  applicationId,
  status,
}: ApplicationActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAction(action: "approve" | "reject") {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/dashboard/campaigns/${campaignId}/applications/${applicationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: action === "approve" ? "APPROVED" : "REJECTED",
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? `Failed to ${action} application`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (status !== "PENDING") return null;

  return (
    <div className="flex items-center gap-1">
      <Button size="xs" onClick={() => handleAction("approve")} disabled={loading}>
        Approve
      </Button>
      <Button
        size="xs"
        variant="destructive"
        onClick={() => handleAction("reject")}
        disabled={loading}
      >
        Reject
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
