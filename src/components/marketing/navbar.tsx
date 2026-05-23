"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
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
  const [openForPath, setOpenForPath] = useState<string | null>(null);
  const open = openForPath === pathname;
  const closeMenu = () => setOpenForPath(null);
  const toggleMenu = () =>
    setOpenForPath((value) => (value === pathname ? null : pathname));

  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--v2-border-light)] bg-[var(--v2-bg)]/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold tracking-tight text-[var(--v2-text)]"
          onClick={closeMenu}
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

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="nav-link text-sm text-[var(--v2-text-secondary)] transition-colors hover:text-[var(--v2-text)]"
          >
            Log in
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          onClick={toggleMenu}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-[var(--v2-border)] text-[var(--v2-accent)] transition-colors hover:bg-[var(--v2-accent-muted)] md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-[var(--v2-border-light)] bg-[var(--v2-bg)] px-4 py-3 md:hidden">
          <div className="grid gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={closeMenu}
                className={`flex min-h-11 items-center justify-between rounded-md px-3 text-sm transition-colors ${
                  pathname === link.href ||
                  (link.href !== "/" && pathname.startsWith(link.href))
                    ? "bg-[var(--v2-accent-muted)] font-medium text-[var(--v2-text)]"
                    : "text-[var(--v2-text-secondary)] hover:bg-[var(--v2-accent-muted)] hover:text-[var(--v2-text)]"
                }`}
              >
                {link.label}
                <span aria-hidden="true">-&gt;</span>
              </Link>
            ))}
            <Link
              href="/login"
              onClick={closeMenu}
              className="flex min-h-11 items-center justify-between rounded-md px-3 text-sm text-[var(--v2-accent)] transition-colors hover:bg-[var(--v2-accent-muted)]"
            >
              Log in
              <span aria-hidden="true">-&gt;</span>
            </Link>
          </div>
        </div>
      ) : null}
    </nav>
  );
}
