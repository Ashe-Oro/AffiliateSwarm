"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: string;
}

interface WebhookManagementProps {
  webhooks: Webhook[];
}

const COMMON_EVENTS = [
  "lead.submitted",
  "lead.verified",
  "lead.rejected",
  "lead.disputed",
  "payout.requested",
  "payout.completed",
  "enrollment.created",
  "enrollment.approved",
  "campaign.activated",
];

export function WebhookManagement({ webhooks }: WebhookManagementProps) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [customEvent, setCustomEvent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function toggleEvent(event: string) {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  }

  function addCustomEvent() {
    const trimmed = customEvent.trim();
    if (trimmed && !selectedEvents.includes(trimmed)) {
      setSelectedEvents((prev) => [...prev, trimmed]);
      setCustomEvent("");
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (selectedEvents.length === 0) {
      setError("Select at least one event type");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/dashboard/settings/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, events: selectedEvents }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message ?? "Failed to create webhook");
      }

      setNewSecret(data.data?.secret ?? null);
      setShowCreate(false);
      setUrl("");
      setSelectedEvents([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(webhookId: string) {
    if (!confirm("Are you sure you want to delete this webhook?")) return;

    setDeletingId(webhookId);
    setError(null);

    try {
      const res = await fetch(`/api/dashboard/settings/webhooks/${webhookId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? "Failed to delete webhook");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {newSecret && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Copy your webhook secret now. It won&apos;t be shown in full again.
          </p>
          <code className="mt-1 block break-all rounded bg-amber-100 px-2 py-1 font-mono text-xs dark:bg-amber-900">
            {newSecret}
          </code>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => setNewSecret(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {webhooks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No webhooks configured.</p>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <div
              key={wh.id}
              className="flex items-start justify-between rounded-md border p-3"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate font-mono text-sm">{wh.url}</p>
                <div className="flex flex-wrap gap-1">
                  {wh.events.map((evt) => (
                    <Badge key={evt} variant="outline" className="text-xs">
                      {evt}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Secret: {wh.secret} &middot;{" "}
                  {wh.active ? "Active" : "Inactive"} &middot; Created{" "}
                  {wh.createdAt}
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="ml-3 shrink-0"
                onClick={() => handleDelete(wh.id)}
                disabled={deletingId === wh.id}
              >
                {deletingId === wh.id ? "Deleting..." : "Delete"}
              </Button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {showCreate ? (
        <form
          onSubmit={handleCreate}
          className="space-y-3 rounded-md border bg-muted p-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="webhook-url">Endpoint URL</Label>
            <Input
              id="webhook-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/webhooks/regatta"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Event Types</Label>
            <div className="flex flex-wrap gap-2">
              {COMMON_EVENTS.map((evt) => (
                <label key={evt} className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(evt)}
                    onChange={() => toggleEvent(evt)}
                    className="h-3.5 w-3.5 rounded border-border"
                  />
                  {evt}
                </label>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={customEvent}
                onChange={(e) => setCustomEvent(e.target.value)}
                placeholder="custom.event.type"
                className="max-w-[200px] text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomEvent();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCustomEvent}
              >
                Add
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={loading || !url || selectedEvents.length === 0}
            >
              {loading ? "Creating..." : "Create Webhook"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowCreate(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
          Add Webhook
        </Button>
      )}
    </div>
  );
}
