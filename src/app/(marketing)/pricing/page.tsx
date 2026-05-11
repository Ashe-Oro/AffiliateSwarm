import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing - AffiliateSwarm",
  description:
    "Simple pricing: 5% platform fee on each verified conversion. Waived during early access.",
};

const faqs = [
  {
    question: "Is there a fee to join?",
    answer:
      "No. Joining AffiliateSwarm as an advertiser or affiliate is completely free. There are no sign-up fees, monthly charges, or minimums to get started.",
  },
  {
    question: "How does the 5% platform fee work?",
    answer:
      "AffiliateSwarm charges a 5% platform fee on each verified conversion. For example, on a $10 CPA payout, the fee is $0.50 — the affiliate receives $9.50. Advertisers deposit the full amount; the fee is deducted when conversions are paid out.",
  },
  {
    question: "What does early access pricing mean?",
    answer:
      "During the early access period, the 5% platform fee on each verified conversion is waived entirely. This lets you try the platform risk-free. We'll give notice before standard pricing takes effect.",
  },
  {
    question: "Are there any other fees?",
    answer:
      "USDC deposits on Base have no AffiliateSwarm deposit fee, though normal network gas may apply. There are no withdrawal fees for affiliates.",
  },
];

export default function Pricing() {
  return (
    <>
      {/* ── HERO ── */}
      <section className="px-6 pb-20 pt-24 sm:pb-28 sm:pt-32">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-[var(--v2-text)] sm:text-5xl lg:text-6xl">
            Simple, Transparent
            <br />
            Pricing
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[var(--v2-text-secondary)]">
            5% platform fee on each verified conversion.{" "}
            <span className="text-[var(--v2-accent)] font-semibold">
              Waived during early access.
            </span>
          </p>
        </div>
      </section>

      {/* ── PRICING CARDS ── */}
      <section className="border-t border-[var(--v2-border)] bg-[var(--v2-bg-elevated)] px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          {/* Early Access Banner */}
          <div className="mb-10 rounded-lg border border-[var(--v2-accent)] bg-[var(--v2-accent-wash)] p-6 text-center">
            <span className="inline-block rounded-full bg-[var(--v2-accent)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--v2-bg)] mb-3">
              Early Access
            </span>
            <p className="text-[var(--v2-text)] font-semibold text-lg">
              Platform fee waived for all early access users
            </p>
            <p className="mt-1 text-sm text-[var(--v2-text-secondary)]">
              Join now and pay $0 in platform fees. We&apos;ll notify you before
              standard pricing begins.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2">
            {/* Advertiser */}
            <div className="v2-card rounded-lg border border-[var(--v2-border)] p-8">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--v2-text-tertiary)]">
                For Advertisers
              </span>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-[var(--v2-accent)]">
                  5%
                </span>
                <span className="text-sm text-[var(--v2-text-secondary)]">
                  per verified conversion
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[var(--v2-text-secondary)]">
                AffiliateSwarm charges a 5% platform fee on each verified
                conversion, deducted from the affiliate payout.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-[var(--v2-text-secondary)]">
                {[
                  "USDC on Base deposits",
                  "No AffiliateSwarm deposit fee",
                  "$10 minimum deposit",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--v2-accent)] shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Affiliate */}
            <div className="v2-card rounded-lg border border-[var(--v2-border)] p-8">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--v2-text-tertiary)]">
                For Affiliates
              </span>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-[var(--v2-accent)]">
                  $0
                </span>
                <span className="text-sm text-[var(--v2-text-secondary)]">
                  to join
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[var(--v2-text-secondary)]">
                Free to join. Affiliates do not pay platform fees.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-[var(--v2-text-secondary)]">
                {[
                  "No sign-up or monthly fees",
                  "No withdrawal fees",
                  "USDC payouts on Base",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--v2-accent)] shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="border-t border-[var(--v2-border)] px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[var(--v2-text)] sm:text-4xl">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="mt-12 space-y-8">
            {faqs.map((faq) => (
              <div
                key={faq.question}
                className="border-b border-[var(--v2-border)] pb-8 last:border-0"
              >
                <h3 className="font-semibold text-[var(--v2-text)]">
                  {faq.question}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--v2-text-secondary)]">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-[var(--v2-border)] bg-[var(--v2-bg-elevated)] px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-[var(--v2-text)] sm:text-4xl">
            Start Free During Early Access
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[var(--v2-text-secondary)]">
            No credit card required. Zero platform fees while you get started.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/for-affiliates"
              className="cta-primary rounded-full bg-[var(--v2-accent)] px-8 py-3.5 text-sm font-medium text-[var(--v2-bg)] transition-colors hover:bg-[var(--v2-accent-hover)]"
            >
              Start as Affiliate &rarr;
            </Link>
            <Link
              href="/for-advertisers"
              className="cta-outline rounded-full border border-[var(--v2-accent)] px-8 py-3.5 text-sm font-medium text-[var(--v2-accent)] transition-colors"
            >
              Launch a Campaign &rarr;
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
