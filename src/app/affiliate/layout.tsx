import Link from "next/link";
import { type ReactNode } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { requireAffiliateDashboardAuth } from "@/lib/auth/affiliate-dashboard";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { RoleTag } from "@/components/ui/role-tag";
import {
  ENABLE_AFFILIATE_REFERRALS_TAB,
  ENABLE_AFFILIATE_REPUTATION_TAB,
} from "@/lib/feature-flags";

type NavItem = { href: string; label: string; enabled?: boolean };

function getNavItems(): NavItem[] {
  const items: NavItem[] = [
    { href: "/affiliate", label: "Overview" },
    { href: "/affiliate/campaigns", label: "My Campaigns" },
    { href: "/affiliate/discover", label: "Discover" },
    { href: "/affiliate/earnings", label: "Earnings" },
    { href: "/affiliate/wallet", label: "Wallet" },
    {
      href: "/affiliate/reputation",
      label: "Reputation",
      enabled: ENABLE_AFFILIATE_REPUTATION_TAB(),
    },
    {
      href: "/affiliate/referrals",
      label: "Referrals",
      enabled: ENABLE_AFFILIATE_REFERRALS_TAB(),
    },
    { href: "/affiliate/settings", label: "Settings" },
  ];
  return items.filter((item) => item.enabled !== false);
}

export default async function AffiliateDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user, agents } = await requireAffiliateDashboardAuth();
  const hasAdvertiserAgent = agents.some(
    (a) => a.type === "ADVERTISER" || a.type === "DUAL"
  );
  const navItems = getNavItems();

  return (
    <div className="v2-brand flex min-h-screen overflow-x-hidden">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:block">
        <div className="flex h-14 items-center border-b border-sidebar-border px-5">
          <Link
            href="/affiliate"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight"
          >
            <BrandLogo markClassName="h-6 w-6" />
          </Link>
          <RoleTag role="affiliate" className="ml-2" />
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {hasAdvertiserAgent && (
          <div className="mt-auto border-t border-sidebar-border p-3">
            <Link
              href="/dashboard"
              className="block rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              Switch to Advertiser Dashboard
            </Link>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 md:flex-nowrap md:px-6">
          <h1 className="text-sm font-medium text-muted-foreground">
            Affiliate Dashboard
          </h1>
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <NotificationBell agentIds={agents.map((a) => a.id)} />
            <span className="hidden max-w-32 truncate text-sm text-muted-foreground sm:inline">
              {user.displayName}
            </span>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Log out
              </button>
            </form>
          </div>
        </header>
        <nav className="flex gap-2 overflow-x-auto border-b border-border px-4 py-2 md:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          {hasAdvertiserAgent && (
            <Link
              href="/dashboard"
              className="shrink-0 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Advertiser
            </Link>
          )}
        </nav>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
