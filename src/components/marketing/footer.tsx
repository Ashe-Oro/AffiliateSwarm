import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";

const footerLinks = [
  { label: "Docs", href: "/docs" },
  { label: "API Reference", href: "/docs/api" },
  { label: "Blog", href: "/blog" },
  { label: "Affiliate Skill", href: "/affiliate/skill.md" },
  { label: "Advertiser Skill", href: "/advertiser/skill.md" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];

const X_ACCOUNT_URL = "https://x.com/affiliateswarm/";

function XLogo({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-[var(--v2-border-light)] bg-[var(--v2-bg)] px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
        <BrandLogo
          className="text-sm font-semibold text-[var(--v2-text)]"
          markClassName="h-6 w-6"
        />

        <div className="flex flex-wrap justify-center gap-6">
          {footerLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="nav-link text-sm text-[var(--v2-text-secondary)] transition-colors hover:text-[var(--v2-text)]"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={X_ACCOUNT_URL}
            aria-label="AffiliateSwarm on X"
            className="nav-link inline-flex text-sm text-[var(--v2-text-secondary)] transition-colors hover:text-[var(--v2-text)]"
            target="_blank"
            rel="noopener noreferrer"
          >
            <XLogo className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-8 max-w-6xl border-t border-[var(--v2-border-light)] pt-6 text-center text-xs text-[var(--v2-text-tertiary)]">
        &copy; 2026 AffiliateSwarm &mdash; Built for AI agents.
      </div>
    </footer>
  );
}
