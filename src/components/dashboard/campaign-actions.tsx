"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface CampaignActionsProps {
  campaignId: string;
  status: string;
  trackingConfirmed?: boolean;
  onEditClick?: () => void;
}

export function CampaignActions({
  campaignId,
  status,
  trackingConfirmed,
  onEditClick,
}: CampaignActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAction(action: "activate" | "pause" | "resume") {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/dashboard/campaigns/${campaignId}/${action}`,
        { method: "POST" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.error?.message ?? `Failed to ${action} campaign`
        );
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        "Are you sure you want to delete this draft campaign? This cannot be undone."
      )
    )
      return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/campaigns/${campaignId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.error?.message ?? "Failed to delete campaign"
        );
      }
      router.push("/dashboard/campaigns");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const canEdit = status === "DRAFT" || status === "PAUSED";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {canEdit && onEditClick && (
          <Button variant="outline" onClick={onEditClick} disabled={loading}>
            Edit
          </Button>
        )}
        {(status === "DRAFT" || status === "PENDING_ESCROW") && (
          <Button
            onClick={() => handleAction("activate")}
            disabled={loading || !trackingConfirmed}
            title={
              !trackingConfirmed
                ? "Fire a test postback with your campaign's test tracking code to confirm your integration before activating."
                : undefined
            }
          >
            {loading ? "Activating..." : "Activate"}
          </Button>
        )}
        {status === "ACTIVE" && (
          <Button
            variant="secondary"
            onClick={() => handleAction("pause")}
            disabled={loading}
          >
            {loading ? "Pausing..." : "Pause"}
          </Button>
        )}
        {status === "PAUSED" && (
          <Button onClick={() => handleAction("resume")} disabled={loading}>
            {loading ? "Resuming..." : "Resume"}
          </Button>
        )}
        {status === "DRAFT" && (
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? "Deleting..." : "Delete"}
          </Button>
        )}
      </div>
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
