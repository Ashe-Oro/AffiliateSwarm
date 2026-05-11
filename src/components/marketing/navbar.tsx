"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";

const navLinks = [
  { id: "DOC.01", label: "For Affiliates", href: "/for-affiliates" },
  { id: "DOC.02", label: "For Advertisers", href: "/for-advertisers" },
  { id: "DOC.03", label: "Pricing", href: "/pricing" },
  { id: "DOC.04", label: "Docs", href: "/docs" },
  { id: "DOC.05", label: "Blog", href: "/blog" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-[rgba(53,242,208,.32)] bg-[var(--v2-bg)]/90 backdrop-blur-lg">
      <div className="grid min-h-16 grid-cols-[1fr_auto] items-stretch xl:grid-cols-[270px_1fr_230px]">
        <Link
          href="/"
          className="flex items-center gap-3 border-r border-[var(--v2-border-light)] px-5 py-3 text-[var(--v2-text)]"
          onClick={() => setOpen(false)}
        >
          <span className="brand-mark-shell rounded-[4px]">
            <BrandMark className="h-9 w-9" />
          </span>
          <span className="font-[family-name:var(--font-geist-mono)] text-sm font-bold uppercase tracking-[0.12em]">
            AffiliateSwarm.ai
            <small className="block text-[10px] font-normal tracking-[0.18em] text-[var(--v2-accent)]">
              Schematic · Rev. A
            </small>
          </span>
        </Link>

        <div className="hidden items-stretch justify-center xl:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={`inline-flex items-center gap-2 border-r border-dashed border-[rgba(53,242,208,.12)] px-5 font-[family-name:var(--font-geist-mono)] text-xs tracking-[0.08em] transition-colors first:border-l ${
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href))
                  ? "text-[var(--v2-text)]"
                  : "text-[var(--v2-text-secondary)] hover:text-[var(--v2-accent)]"
              }`}
            >
              <span className="schematic-id text-[9px]">{link.id}</span>
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden border-l border-[var(--v2-border-light)] px-5 py-2 font-[family-name:var(--font-geist-mono)] text-[9.5px] uppercase tracking-[0.06em] text-[var(--v2-text-tertiary)] 2xl:grid 2xl:grid-cols-[auto_auto] 2xl:content-center 2xl:gap-x-3">
          <span className="text-[var(--v2-accent)]">Drawing</span>
          <b className="text-[var(--v2-text)]">Swarm-001</b>
          <span className="text-[var(--v2-accent)]">Scale</span>
          <b className="text-[var(--v2-text)]">1:1</b>
          <span className="text-[var(--v2-accent)]">Sign In</span>
          <Link href="/login" className="text-[var(--v2-text)] hover:text-[var(--v2-accent)]">
            Login
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="mr-3 inline-flex h-10 w-10 items-center justify-center rounded-[4px] border border-[var(--v2-border)] text-[var(--v2-accent)] xl:hidden"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-[var(--v2-border)] bg-[var(--v2-bg)] p-3 xl:hidden">
          <div className="schematic-node p-3">
            <div className="schematic-pin mb-3">
              <b>NAV</b>
              <span aria-hidden="true">mobile · routes</span>
            </div>
            <div className="grid gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex h-12 items-center justify-between border-b border-dashed border-[rgba(53,242,208,.14)] px-2 font-[family-name:var(--font-geist-mono)] text-sm text-[var(--v2-text-secondary)] last:border-0 hover:text-[var(--v2-accent)]"
                >
                  <span>
                    <span className="schematic-id mr-3 text-[9px]">{link.id}</span>
                    {link.label}
                  </span>
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="flex h-12 items-center justify-between px-2 font-[family-name:var(--font-geist-mono)] text-sm text-[var(--v2-accent)]"
              >
                Log in
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </nav>
  );
}
