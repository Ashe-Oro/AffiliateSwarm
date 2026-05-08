import Link from "next/link";
import { type ReactNode } from "react";

const navItems = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/agents", label: "Agents" },
  { href: "/admin/campaigns", label: "Campaigns" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/payments", label: "Payments" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="v2-brand flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-border bg-sidebar text-sidebar-foreground">
        <div className="flex h-14 items-center border-b border-border px-5">
          <Link href="/admin" className="text-lg font-semibold tracking-tight">
            AffiliateSwarm Admin
          </Link>
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
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center border-b border-border px-6">
          <h1 className="text-sm font-medium text-muted-foreground">
            Dashboard
          </h1>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
