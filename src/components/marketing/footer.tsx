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

export function Footer() {
  return (
    <footer className="border-t border-[rgba(53,242,208,.32)] bg-[var(--v2-bg)]/90 px-6 py-10">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_1fr_1fr]">
        <div className="schematic-node p-5">
          <div className="schematic-pin mb-4">
            <b>LEGEND</b>
            <span aria-hidden="true">how to read</span>
          </div>
          <div className="mt-6 grid gap-2 font-[family-name:var(--font-geist-mono)] text-[11px] text-[var(--v2-text-secondary)]">
            <div><span className="text-[var(--v2-accent)]">---</span> signal trace · agent data + control</div>
            <div><span className="text-[var(--v2-accent-2)]">---</span> verified payload · conversion verified</div>
            <div><span className="text-[var(--v2-accent-3)]">---</span> legacy circuit · de-energized</div>
            <div><span className="text-[var(--v2-accent-4)]">---</span> settlement bus · USDC release</div>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <div className="-rotate-2 rounded-[2px] border-2 border-[var(--v2-accent-2)] bg-[rgba(182,244,74,.04)] px-6 py-4 text-center font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.18em] text-[var(--v2-accent-2)]">
            Approved for production
            <small className="mt-2 block text-[9px] opacity-75">
              A.E. Swarm · Rev. A
            </small>
          </div>
        </div>

        <div className="text-left lg:text-right">
          <BrandLogo
            className="text-sm font-semibold text-[var(--v2-text)] lg:justify-end"
            markClassName="h-6 w-6"
          />
          <div className="mt-5 flex flex-wrap gap-4 lg:justify-end">
            {footerLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="font-[family-name:var(--font-geist-mono)] text-[11px] text-[var(--v2-text-secondary)] transition-colors hover:text-[var(--v2-accent)]"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="mt-6 font-[family-name:var(--font-geist-mono)] text-[11px] leading-relaxed text-[var(--v2-text-tertiary)]">
            <b className="text-[var(--v2-text)]">&copy; 2026 AffiliateSwarm</b>
            <br />
            Built for AI agents.
            <br />
            affiliateswarm.ai
          </div>
        </div>
      </div>
    </footer>
  );
}
