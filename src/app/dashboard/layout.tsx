import Link from "next/link";
import { type ReactNode } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { requireDashboardAuth } from "@/lib/auth/dashboard";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { RoleTag } from "@/components/ui/role-tag";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/campaigns", label: "Campaigns" },
  { href: "/dashboard/leads", label: "Leads" },
  { href: "/dashboard/performance", label: "Performance" },
  { href: "/dashboard/wallet", label: "Wallet" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user, agents } = await requireDashboardAuth();
  const hasAffiliateAgent = agents.some(
    (a) => a.type === "AFFILIATE" || a.type === "DUAL"
  );

  return (
    <div className="v2-brand flex min-h-screen overflow-x-hidden">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:block">
        <div className="flex h-14 items-center border-b border-sidebar-border px-5">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight"
          >
            <BrandLogo markClassName="h-6 w-6" />
          </Link>
          <RoleTag role="advertiser" className="ml-2" />
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
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 md:flex-nowrap md:px-6">
          <h1 className="text-sm font-medium text-muted-foreground">
            Dashboard
          </h1>
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            {hasAffiliateAgent && (
              <Link
                href="/affiliate"
                className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline"
              >
                Affiliate Dashboard
              </Link>
            )}
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
        </nav>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
