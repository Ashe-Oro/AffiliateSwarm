"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface DisputeConversionDialogProps {
  leadId: string;
  canDispute: boolean;
}

export function DisputeConversionDialog({
  leadId,
  canDispute,
}: DisputeConversionDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Please provide a reason.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/leads/${leadId}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message =
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? "Failed to dispute conversion";
        throw new Error(message);
      }
      setOpen(false);
      setReason("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!canDispute) {
    return (
      <Button size="xs" variant="outline" disabled>
        Dispute
      </Button>
    );
  }

  return (
    <>
      <Button
        size="xs"
        variant="destructive"
        onClick={() => setOpen(true)}
      >
        Dispute
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => !loading && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">Dispute conversion</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              This will reverse the payout and refund the escrow. Only possible
              during the hold window.
            </p>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`dispute-reason-${leadId}`}>Reason</Label>
                <Textarea
                  id={`dispute-reason-${leadId}`}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this conversion should be reversed."
                  rows={4}
                  required
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  size="sm"
                  disabled={loading}
                >
                  {loading ? "Submitting..." : "Submit dispute"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
