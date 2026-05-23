import Link from "next/link";
import { type ReactNode } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";

const navItems = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/agents", label: "Agents" },
  { href: "/admin/campaigns", label: "Campaigns" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/payments", label: "Payments" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="v2-brand flex min-h-screen overflow-x-hidden">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-border bg-sidebar text-sidebar-foreground md:block">
        <div className="flex h-14 items-center border-b border-border px-5">
          <Link href="/admin" className="text-lg font-semibold tracking-tight">
            <BrandLogo markClassName="h-6 w-6" suffix="Admin" />
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
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 items-center border-b border-border px-4 py-3 md:px-6">
          <h1 className="text-sm font-medium text-muted-foreground">
            Dashboard
          </h1>
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
