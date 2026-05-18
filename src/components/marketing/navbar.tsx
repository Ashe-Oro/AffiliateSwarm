"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand/brand-logo";

const navLinks = [
  { label: "For Advertisers", href: "/for-advertisers" },
  { label: "For Affiliates", href: "/for-affiliates" },
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "/docs" },
  { label: "Blog", href: "/blog" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--v2-border-light)] bg-[var(--v2-bg)]/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold tracking-tight text-[var(--v2-text)]"
        >
          <BrandLogo markClassName="h-7 w-7" />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={`nav-link text-sm transition-colors ${
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href))
                  ? "font-medium text-[var(--v2-text)]"
                  : "text-[var(--v2-text-secondary)] hover:text-[var(--v2-text)]"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="nav-link text-sm text-[var(--v2-text-secondary)] transition-colors hover:text-[var(--v2-text)]"
          >
            Log in
          </Link>
        </div>
      </div>
    </nav>
  );
}
