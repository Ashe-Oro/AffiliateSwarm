"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

interface Campaign {
  id: string;
  name: string;
}

interface CreateReferralFormProps {
  campaigns: Campaign[];
}

export function CreateReferralForm({ campaigns }: CreateReferralFormProps) {
  const router = useRouter();
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [expiresInHours, setExpiresInHours] = useState("720");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/dashboard/affiliate/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          expiresInHours: parseInt(expiresInHours, 10),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message ?? "Failed to create referral");
        return;
      }

      setToken(data.data?.token ?? null);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {token && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
            Referral token created:
          </p>
          <code className="mt-1 block break-all rounded bg-emerald-100 px-2 py-1 font-mono text-xs dark:bg-emerald-900">
            {token}
          </code>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => setToken(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ref-campaign">Campaign</Label>
          <Select
            id="ref-campaign"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ref-expires">Expires in (hours)</Label>
          <Input
            id="ref-expires"
            type="number"
            min="1"
            max="8760"
            value={expiresInHours}
            onChange={(e) => setExpiresInHours(e.target.value)}
            className="w-28"
          />
        </div>

        <Button type="submit" disabled={loading || !campaignId}>
          {loading ? "Creating..." : "Create"}
        </Button>
      </form>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
