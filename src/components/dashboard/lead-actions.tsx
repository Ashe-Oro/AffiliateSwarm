"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface LeadActionsProps {
  leadId: string;
  status: string;
  compensationModel: string;
}

export function LeadActions({ leadId, status, compensationModel }: LeadActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canVerifyOrReject =
    (status === "SUBMITTED" || status === "PENDING_VERIFICATION") &&
    compensationModel !== "CPA";
  const canDispute = status === "VERIFIED";

  async function parseErrorMessage(res: Response, fallback: string) {
    const data = await res.json().catch(() => ({}));
    return typeof data.error === "string"
      ? data.error
      : data.error?.message ?? fallback;
  }

  async function handleVerify() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/leads/${leadId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res, "Failed to verify lead"));
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    const reason = window.prompt("Enter rejection reason:");
    if (!reason) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/leads/${leadId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res, "Failed to reject lead"));
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleDispute() {
    const reason = window.prompt("Enter dispute reason:");
    if (!reason) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/leads/${leadId}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res, "Failed to dispute lead"));
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!canVerifyOrReject && !canDispute) return null;

  return (
    <div className="flex items-center gap-1">
      {canVerifyOrReject && (
        <>
          <Button size="xs" onClick={handleVerify} disabled={loading}>
            Verify
          </Button>
          <Button
            size="xs"
            variant="destructive"
            onClick={handleReject}
            disabled={loading}
          >
            Reject
          </Button>
        </>
      )}
      {canDispute && (
        <Button
          size="xs"
          variant="destructive"
          onClick={handleDispute}
          disabled={loading}
        >
          Dispute
        </Button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
