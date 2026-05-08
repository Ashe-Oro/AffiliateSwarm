import Image from "next/image";
import Link from "next/link";
import { type ReactNode } from "react";
import { requireDashboardAuth } from "@/lib/auth/dashboard";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { RoleTag } from "@/components/ui/role-tag";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/campaigns", label: "Campaigns" },
  { href: "/dashboard/leads", label: "Leads" },
  { href: "/dashboard/conversions", label: "Conversions" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/wallet", label: "Wallet" },
  { href: "/dashboard/live", label: "Live" },
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
    <div className="v2-brand flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex h-14 items-center border-b border-sidebar-border px-5">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight"
          >
            <Image src="/affiliateswarm-logo.jpg" alt="AffiliateSwarm" width={24} height={24} className="rounded" />
            AffiliateSwarm
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
      <div className="flex flex-1 flex-col bg-background">
        <header className="flex h-14 items-center justify-between border-b border-border px-6">
          <h1 className="text-sm font-medium text-muted-foreground">
            Dashboard
          </h1>
          <div className="flex items-center gap-4">
            {hasAffiliateAgent && (
              <Link
                href="/affiliate"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Affiliate Dashboard
              </Link>
            )}
            <NotificationBell agentIds={agents.map((a) => a.id)} />
            <span className="text-sm text-muted-foreground">
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
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
