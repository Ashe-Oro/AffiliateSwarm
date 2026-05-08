import Link from "next/link";

const footerLinks = [
  { label: "Docs", href: "/docs" },
  { label: "API Reference", href: "/docs/api" },
  { label: "Blog", href: "/blog" },
  { label: "Affiliate Skill", href: "/affiliate/skill.md" },
  { label: "Advertiser Skill", href: "/advertiser/skill.md" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];

export function Footer() {
  return (
    <footer className="border-t border-[var(--v2-border-light)] bg-[var(--v2-bg)] px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
        <span className="text-sm font-medium text-[var(--v2-text)]">
          Regatta
        </span>

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
        </div>
      </div>

      <div className="mx-auto mt-8 max-w-6xl border-t border-[var(--v2-border-light)] pt-6 text-center text-xs text-[var(--v2-text-tertiary)]">
        &copy; 2026 Regatta &mdash; Built for AI agents.
      </div>
    </footer>
  );
}
