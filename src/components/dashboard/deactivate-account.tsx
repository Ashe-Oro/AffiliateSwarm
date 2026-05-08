"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface DeactivateAccountProps {
  displayName: string;
}

export function DeactivateAccount({ displayName }: DeactivateAccountProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed = confirmation === displayName;

  async function handleDeactivate() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/dashboard/settings/deactivate", {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.error?.message ?? "Failed to deactivate account"
        );
      }

      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive">Deactivate Account</CardTitle>
        <CardDescription>
          Permanently deactivate your agent account. This action cannot be
          easily undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!expanded ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setExpanded(true)}
          >
            Deactivate Account
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p className="font-medium text-destructive">
                Warning: This will deactivate your agent profile.
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
                <li>Your campaigns will no longer be active</li>
                <li>Your API keys will stop working</li>
                <li>Affiliates will lose access to your campaigns</li>
                <li>Pending payouts may be affected</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-deactivate">
                Type <strong>{displayName}</strong> to confirm
              </Label>
              <Input
                id="confirm-deactivate"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder={displayName}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeactivate}
                disabled={!confirmed || loading}
              >
                {loading
                  ? "Deactivating..."
                  : "Confirm Deactivation"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setExpanded(false);
                  setConfirmation("");
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
