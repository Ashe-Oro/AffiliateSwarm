"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ApiKey {
  id: string;
  apiKeyPrefix: string;
  label: string;
  scopes: string[];
  rateLimitTier: string;
  lastUsedAt: string | null;
  createdAt: string;
}

interface ApiKeyManagementProps {
  credentials: ApiKey[];
}

export function ApiKeyManagement({ credentials }: ApiKeyManagementProps) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    if (!revealedKey) return;

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setRevealedKey(null);
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [revealedKey]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/dashboard/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message ?? "Failed to create API key");
      }

      const createdKey =
        data.data?.apiKey ?? data.data?.key ?? data.data?.rawKey ?? null;

      if (!createdKey) {
        throw new Error("API key was created, but the raw key was not returned");
      }

      setRevealedKey(createdKey);
      setShowCreate(false);
      setLabel("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(keyId: string) {
    if (!confirm("Are you sure you want to revoke this API key?")) return;

    setRevokingId(keyId);
    setError(null);

    try {
      const res = await fetch(
        `/api/dashboard/settings/api-keys/${keyId}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? "Failed to revoke API key");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setRevokingId(null);
    }
  }

  function describeAccess(scopes: string[]) {
    if (scopes.length === 0 || scopes.includes("*")) {
      return {
        label: "Full access",
        detail: "Can access this account's API endpoints allowed by your agent role.",
      };
    }

    return {
      label: "Legacy scope set",
      detail: `Stored scopes: ${scopes.join(", ")}. These scopes are not currently enforced.`,
    };
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
        New dashboard API keys currently have full access for this agent. Scoped
        permissions are not available here until enforcement is implemented.
      </div>

      {credentials.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No active API keys found.
        </p>
      ) : (
        <div className="space-y-3">
          {credentials.map((cred) => {
            const access = describeAccess(cred.scopes);

            return (
              <div
                key={cred.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium">{cred.label}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {cred.apiKeyPrefix}...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {access.label}
                    </span>{" "}
                    - {access.detail}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right text-xs text-muted-foreground">
                    <p>Tier: {cred.rateLimitTier}</p>
                    <p>Created {cred.createdAt}</p>
                    {cred.lastUsedAt && <p>Last used {cred.lastUsedAt}</p>}
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRevoke(cred.id)}
                    disabled={revokingId === cred.id}
                  >
                    {revokingId === cred.id ? "Revoking..." : "Revoke"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {showCreate ? (
        <form
          onSubmit={handleCreate}
          className="space-y-3 rounded-md border bg-muted p-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="key-label">Label</Label>
            <Input
              id="key-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="My integration key"
              required
              maxLength={100}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={loading || !label}>
              {loading ? "Creating..." : "Create Key"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
          Create API Key
        </Button>
      )}

      {revealedKey && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="api-key-created-title"
        >
          <div className="w-full max-w-xl rounded-xl border bg-background p-6 shadow-2xl">
            <div className="space-y-2">
              <h3 id="api-key-created-title" className="text-lg font-semibold">
                API key created
              </h3>
              <p className="text-sm text-muted-foreground">
                This key has full access for this agent account. Copy and store
                it now because Regatta will not show the full key again.
              </p>
            </div>

            <code className="mt-4 block break-all rounded-md border bg-muted px-3 py-3 font-mono text-xs">
              {revealedKey}
            </code>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <CopyButton
                text={revealedKey}
                label="Copy key"
                copiedLabel="Copied"
              />
              <Button type="button" onClick={() => setRevealedKey(null)}>
                I&apos;ve saved it
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
