import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - AffiliateSwarm",
  description:
    "AffiliateSwarm privacy policy describing how we collect, use, and protect your data.",
};

const EFFECTIVE_DATE = "April 13, 2026";
const CONTACT_EMAIL = "privacy@your-deployment.example";

const sections = [
  {
    title: "1. Information We Collect",
    content:
      "We collect information you provide when registering an account: email address, display name, and wallet addresses. For advertisers, we collect USDC deposit and wallet details needed to operate payments. For affiliates, we collect audience profile data you optionally provide (audience size, channels, content type, geographic focus). We also collect API usage logs, IP addresses, and browser metadata for security and analytics purposes.",
  },
  {
    title: "2. How We Use Your Information",
    content:
      "We use your information to: (a) operate and improve the Service; (b) process transactions, deposits, and payouts; (c) verify conversions and prevent fraud; (d) send transactional emails (verification, payout confirmations, campaign alerts); (e) comply with legal obligations. We do not sell your personal information to third parties.",
  },
  {
    title: "3. AI Agent Data",
    content:
      "When AI agents interact with our API on your behalf, we log API requests including authentication tokens (hashed), request payloads, and response metadata. Agent-submitted data (leads, applications, campaign configurations) is treated the same as user-submitted data. We do not train AI models on your data.",
  },
  {
    title: "4. Payment Data",
    content:
      "USDC transactions on Base are recorded by blockchain transaction hash and wallet address. We do not store raw private keys in client-accessible storage.",
  },
  {
    title: "5. Data Sharing",
    content:
      "We share data with: (a) Resend for transactional email delivery; (b) Vercel for hosting and serverless infrastructure; (c) law enforcement when required by valid legal process. Advertisers see affiliate display names and lead data for their campaigns. Affiliates see campaign details and advertiser display names. Neither party sees the other's email address or financial details unless voluntarily shared.",
  },
  {
    title: "6. Data Retention",
    content:
      "Account data is retained while your account is active. Financial records (ledger entries, transactions, escrow holds) are retained for 7 years for regulatory compliance. API logs are retained for 90 days. You may request account deletion by contacting us; financial records required for compliance will be anonymized rather than deleted.",
  },
  {
    title: "7. Security",
    content:
      "We implement industry-standard security measures including: encrypted connections (TLS), hashed API keys and passwords, role-based access controls, and double-entry ledger integrity checks. Custodial wallet keys are derived from an HD seed stored in encrypted environment variables — never in source code or client-accessible storage.",
  },
  {
    title: "8. Cookies",
    content:
      "We use essential cookies for session management and authentication. We do not use advertising cookies or third-party tracking pixels. Vercel Analytics collects anonymous, aggregated usage data.",
  },
  {
    title: "9. Your Rights",
    content:
      "Depending on your jurisdiction, you may have the right to: access your personal data, correct inaccuracies, request deletion, restrict processing, or export your data. To exercise these rights, contact us at the email below. We will respond within 30 days.",
  },
  {
    title: "10. International Transfers",
    content:
      "Our servers are hosted in the United States via Vercel. If you access the Service from outside the US, your data will be transferred to and processed in the United States. By using the Service, you consent to this transfer.",
  },
  {
    title: "11. Children",
    content:
      "The Service is not intended for users under 18. We do not knowingly collect personal information from minors. If you believe a minor has provided us data, contact us and we will delete it.",
  },
  {
    title: "12. Changes to This Policy",
    content:
      "We may update this policy from time to time. Material changes will be communicated via email or platform notification. The effective date at the top of this page indicates when the policy was last revised.",
  },
  {
    title: "13. Contact",
    content: `For privacy-related questions or requests, contact us at ${CONTACT_EMAIL}.`,
  },
];

export default function Privacy() {
  return (
    <section className="px-6 pb-20 pt-24 sm:pb-28 sm:pt-32">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold leading-tight tracking-tight text-[var(--v2-text)] sm:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-4 text-sm text-[var(--v2-text-tertiary)]">
          Effective date: {EFFECTIVE_DATE}
        </p>

        <div className="mt-12 space-y-10">
          {sections.map((section) => (
            <div key={section.title}>
              <h2 className="text-lg font-semibold text-[var(--v2-text)]">
                {section.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--v2-text-secondary)]">
                {section.content}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
