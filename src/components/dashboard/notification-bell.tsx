"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { Bell, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Notification {
  id: string;
  eventType: string;
  category: string;
  title: string;
  summary: string;
  resourceType: string | null;
  resourceId: string | null;
  read: boolean;
  createdAt: string;
}

interface NotificationBellProps {
  agentIds: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const CATEGORY_COLORS: Record<string, string> = {
  CAMPAIGNS: "bg-blue-500/20 text-blue-400",
  APPLICATIONS: "bg-purple-500/20 text-purple-400",
  LEADS: "bg-green-500/20 text-green-400",
  TRACKING: "bg-[var(--v2-accent-muted)] text-[var(--v2-accent)]",
  EARNINGS: "bg-emerald-500/20 text-emerald-400",
  PAYOUTS: "bg-cyan-500/20 text-cyan-400",
};

const CATEGORY_LABELS: Record<string, string> = {
  CAMPAIGNS: "Campaign",
  APPLICATIONS: "Application",
  LEADS: "Lead",
  TRACKING: "Tracking",
  EARNINGS: "Earnings",
  PAYOUTS: "Payout",
};

function triggerClassName(isOpen: boolean, hasUnread: boolean): string {
  if (isOpen) return "bg-primary/10 text-primary";
  if (hasUnread) return "text-foreground hover:bg-muted";
  return "text-muted-foreground hover:bg-muted hover:text-foreground";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationBell({ agentIds }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const hasFetched = useRef(false);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (agentIds.length === 0) return;
    try {
      const res = await fetch("/api/dashboard/notifications/unread-count");
      if (res.ok) {
        const json = await res.json();
        setUnreadCount(json.data.unreadCount);
      }
    } catch {
      // Silently fail — badge just won't update
    }
  }, [agentIds.length]);

  // Fetch notifications list
  const fetchNotifications = useCallback(async () => {
    if (agentIds.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/notifications?pageSize=20");
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.data);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [agentIds.length]);

  // Poll unread count every 30s
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30_000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Fetch notifications when popover opens
  useEffect(() => {
    if (open && !hasFetched.current) {
      hasFetched.current = true;
      fetchNotifications();
    }
    if (!open) {
      hasFetched.current = false;
    }
  }, [open, fetchNotifications]);

  // Mark one as read
  async function handleMarkRead(id: string) {
    try {
      const res = await fetch(`/api/dashboard/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch {
      // Silently fail
    }
  }

  // Mark all as read
  async function handleMarkAllRead() {
    try {
      const res = await fetch("/api/dashboard/notifications/mark-all-read", {
        method: "POST",
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch {
      // Silently fail
    }
  }

  const hasUnread = unreadCount > 0;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={cn(
          "relative rounded-full p-2 transition-colors",
          triggerClassName(open, hasUnread)
        )}
        aria-label="Notifications"
      >
        <Bell className={cn("size-5", hasUnread && "fill-current")} />
        {hasUnread && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold leading-[18px] text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={4}>
          <Popover.Popup className="z-50 w-[380px] rounded-xl border border-border bg-popover shadow-xl outline-none">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3">
              <h3 className="text-base font-bold text-foreground">
                Notifications
              </h3>
              {hasUnread && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  <Check className="size-3.5" />
                  Mark all read
                </button>
              )}
            </div>

            {/* Notification list */}
            <div className="max-h-[420px] overflow-y-auto">
              {loading && notifications.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                  <Bell className="size-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    No notifications yet
                  </p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      "group relative flex items-start gap-3 px-4 py-3 transition-colors",
                      n.read
                        ? "opacity-50"
                        : "bg-primary/[0.03] hover:bg-primary/[0.06]"
                    )}
                  >
                    {/* Unread dot */}
                    <span
                      className={cn(
                        "mt-1.5 size-2.5 shrink-0 rounded-full",
                        !n.read && "bg-primary"
                      )}
                    />

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-medium",
                            CATEGORY_COLORS[n.category] ??
                              "bg-muted text-muted-foreground"
                          )}
                        >
                          {CATEGORY_LABELS[n.category] ?? n.category}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {relativeTime(n.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {n.title}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {n.summary}
                      </p>
                    </div>

                    {/* Dismiss button — only for unread */}
                    {!n.read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkRead(n.id);
                        }}
                        className="mt-0.5 shrink-0 rounded-full p-1 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100"
                        aria-label="Dismiss notification"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
