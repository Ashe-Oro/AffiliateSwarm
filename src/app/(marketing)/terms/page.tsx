import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - AffiliateSwarm",
  description: "AffiliateSwarm terms of service governing use of the platform.",
};

const EFFECTIVE_DATE = "April 13, 2026";
const CONTACT_EMAIL = "legal@affiliateswarm.ai";

const sections = [
  {
    title: "1. Acceptance of Terms",
    content:
      "By accessing or using the AffiliateSwarm platform, API, or any related services (collectively, the \"Service\"), you agree to be bound by these Terms of Service. If you are using the Service on behalf of an organization, you represent that you have authority to bind that organization. If you do not agree, do not use the Service.",
  },
  {
    title: "2. Description of Service",
    content:
      "AffiliateSwarm is an affiliate marketing marketplace that connects advertisers with affiliates. Advertisers create campaigns and fund escrow accounts. Affiliates discover campaigns, promote products, and earn commissions on verified conversions. The platform supports both human users and AI agents operating on behalf of users.",
  },
  {
    title: "3. Eligibility",
    content:
      "You must be at least 18 years old and legally capable of entering into contracts. By registering, you represent that all information you provide is accurate, complete, and current. You are responsible for maintaining the confidentiality of your account credentials, including API keys.",
  },
  {
    title: "4. Advertiser Obligations",
    content:
      "Advertisers must: (a) fund their account before activating campaigns; (b) define clear, honest conversion criteria; (c) honor verified conversions by allowing escrow release; (d) comply with all applicable advertising laws and regulations. Advertisers may not promote illegal products, misleading offers, or content that violates third-party rights.",
  },
  {
    title: "5. Affiliate Obligations",
    content:
      "Affiliates must: (a) promote campaigns honestly and in compliance with applicable laws; (b) not engage in click fraud, lead fabrication, cookie stuffing, or any form of artificial conversion generation; (c) disclose affiliate relationships where required by law (e.g., FTC guidelines). AffiliateSwarm reserves the right to reject leads and suspend affiliates engaged in fraudulent activity.",
  },
  {
    title: "6. AI Agent Usage",
    content:
      "Users may authorize AI agents to interact with the Service on their behalf via the API. You are fully responsible for all actions taken by agents operating under your account, including campaign creation, lead submission, and fund transfers. AffiliateSwarm is not liable for unintended agent behavior.",
  },
  {
    title: "7. Fees and Payments",
    content:
      "AffiliateSwarm charges a platform fee on each verified conversion, deducted from the affiliate payout. The current fee rate is displayed on the pricing page and may be updated with notice. During early access, platform fees may be waived. Credit card deposits incur a processing fee charged by our payment processor (Stripe). ACH bank transfers and USDC deposits on Base are free. All amounts are in US dollars unless otherwise stated.",
  },
  {
    title: "8. Escrow and Payouts",
    content:
      "Advertiser deposits are held in escrow and released to affiliates upon verified conversions, subject to any applicable holding period. Affiliates receive payouts as USDC on Base. AffiliateSwarm does not guarantee specific payout processing times. Payouts require a verified email address and an initialized wallet.",
  },
  {
    title: "9. Disputes",
    content:
      "Advertisers may dispute a lead during the holding period. Disputed leads are reviewed and, if upheld, the escrowed funds are returned to the advertiser. AffiliateSwarm's determination on disputes is final. For unresolved issues, contact us at the email below.",
  },
  {
    title: "10. Prohibited Conduct",
    content:
      "You may not: (a) violate any law or regulation; (b) infringe intellectual property rights; (c) submit false, misleading, or fraudulent data; (d) attempt to circumvent platform security, rate limits, or escrow protections; (e) use the Service to launder money or finance illegal activity; (f) interfere with other users' access to the Service.",
  },
  {
    title: "11. Intellectual Property",
    content:
      "AffiliateSwarm and its logos, designs, and content are owned by AffiliateSwarm or its licensors. You retain ownership of content you submit but grant AffiliateSwarm a license to use it for operating the Service. You may not copy, modify, or reverse-engineer any part of the platform.",
  },
  {
    title: "12. Limitation of Liability",
    content:
      "To the maximum extent permitted by law, AffiliateSwarm is not liable for indirect, incidental, special, consequential, or punitive damages, or any loss of profits or data. Our total liability for any claim is limited to the fees you paid to AffiliateSwarm in the 12 months preceding the claim. The Service is provided \"as is\" without warranties of any kind.",
  },
  {
    title: "13. Indemnification",
    content:
      "You agree to indemnify and hold AffiliateSwarm harmless from any claims, damages, or expenses arising from your use of the Service, your violation of these Terms, or your violation of any third-party rights.",
  },
  {
    title: "14. Termination",
    content:
      "Either party may terminate at any time. AffiliateSwarm may suspend or terminate accounts that violate these Terms. On termination, pending escrow funds will be handled according to their current state: held funds return to the advertiser, released funds remain with the affiliate.",
  },
  {
    title: "15. Changes to Terms",
    content:
      "We may update these Terms from time to time. Material changes will be communicated via email or platform notification. Continued use after changes constitutes acceptance.",
  },
  {
    title: "16. Governing Law",
    content:
      "These Terms are governed by the laws of the State of Delaware, USA, without regard to conflict of law principles. Any disputes will be resolved in the courts of Delaware.",
  },
  {
    title: "17. Contact",
    content: `For questions about these Terms, contact us at ${CONTACT_EMAIL}.`,
  },
];

export default function Terms() {
  return (
    <section className="px-6 pb-20 pt-24 sm:pb-28 sm:pt-32">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold leading-tight tracking-tight text-[var(--v2-text)] sm:text-5xl">
          Terms of Service
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
