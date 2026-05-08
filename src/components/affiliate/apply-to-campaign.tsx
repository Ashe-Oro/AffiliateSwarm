"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface ApplyToCampaignProps {
  campaignId: string;
  enrollmentPolicy: string;
}

interface ApplyResult {
  status: "APPROVED" | "PENDING";
  trackingCode: string | null;
}

export function ApplyToCampaign({
  campaignId,
  enrollmentPolicy,
}: ApplyToCampaignProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [pitch, setPitch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApplyResult | null>(null);

  async function handleSubmit() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/dashboard/affiliate/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          pitch: pitch.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message ?? "Failed to apply");
        return;
      }

      setResult({
        status: data.data.status,
        trackingCode: data.data.trackingCode,
      });

      // Refresh server data so the page reflects the new enrollment
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // After successful application
  if (result) {
    return (
      <div className="mt-3 rounded-md border bg-muted p-3">
        {result.status === "APPROVED" ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="default">approved</Badge>
              <span className="text-sm text-muted-foreground">
                You&apos;re in! Your application was auto-approved.
              </span>
            </div>
            {result.trackingCode && (
              <p className="text-xs text-muted-foreground">
                Tracking code: <code className="font-mono">{result.trackingCode}</code>
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">pending</Badge>
            <span className="text-sm text-muted-foreground">
              Application submitted. The campaign owner will review it.
            </span>
          </div>
        )}
      </div>
    );
  }

  // Collapsed: just the Apply button
  if (!expanded) {
    return (
      <Button size="sm" onClick={() => setExpanded(true)}>
        Apply
      </Button>
    );
  }

  // Expanded: pitch form
  return (
    <div className="mt-3 space-y-3 rounded-md border bg-muted p-3">
      {enrollmentPolicy === "OPEN" && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          This campaign auto-approves applications.
        </p>
      )}
      <Textarea
        placeholder="Why are you a good fit for this campaign? (optional)"
        value={pitch}
        onChange={(e) => setPitch(e.target.value)}
        rows={3}
        maxLength={5000}
      />
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={loading}>
          {loading ? "Submitting..." : "Submit Application"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setExpanded(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
