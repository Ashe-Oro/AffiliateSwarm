"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type MobileDashboardNavItem = {
  href: string;
  label: string;
};

function isActivePath(pathname: string, href: string) {
  if (pathname === href) {
    return true;
  }

  const segments = href.split("/").filter(Boolean);
  const terminalSegment = segments[segments.length - 1];
  if (
    terminalSegment === "dashboard" ||
    terminalSegment === "affiliate" ||
    terminalSegment === "admin"
  ) {
    return false;
  }

  return pathname.startsWith(`${href}/`);
}

export function MobileDashboardNav({
  items,
  label = "Dashboard navigation",
}: {
  items: MobileDashboardNavItem[];
  label?: string;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={label}
      className="flex gap-2 overflow-x-auto border-b border-border px-4 py-2 md:hidden"
    >
      {items.map((item) => {
        const active = isActivePath(pathname, item.href);

        return (
          <Link
            key={`${item.href}-${item.label}`}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              active && "bg-muted text-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
