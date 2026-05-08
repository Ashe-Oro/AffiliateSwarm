import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCampaignPayout, formatCents } from "@/lib/utils";
import { formatHoldingPeriodDays } from "@/lib/campaign-formatters";

export interface CampaignSettingsPanelProps {
  compensationModel: string;
  payoutPerUnitCents: number | null;
  payoutPercentage: number | null;
  currency: string;
  enrollmentPolicy: string;
  landingUrl: string | null;
  geoTargets: string[];
  categories: string[];
  budgetCents: number;
  dailyCapCount: number | null;
  dailyCapCents: number | null;
  requiresVerification: boolean;
  holdingPeriodDays: number;
  buyerIncentiveType: string | null;
  buyerIncentiveValue: string | null;
  buyerIncentiveLabel: string | null;
  buyerCouponCode: string | null;
  platformFeeRate: number;
  createdAt: string;
  updatedAt: string;
}

export function CampaignSettingsPanel(props: CampaignSettingsPanelProps) {
  const hasBuyerIncentive = !!(
    props.buyerIncentiveType ||
    props.buyerIncentiveLabel ||
    props.buyerCouponCode ||
    props.buyerIncentiveValue
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign Settings</CardTitle>
        <CardDescription>
          Read-only view of every parameter configured on this campaign.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Section title="Basics">
          <Row
            label="Compensation Model"
            value={compensationModelLabel(props.compensationModel)}
          />
          <Row
            label={
              props.compensationModel === "REV_SHARE"
                ? "Percent of initial sale"
                : "Payout per Unit"
            }
            value={formatCampaignPayout({
              compensationModel: props.compensationModel,
              payoutPerUnitCents: props.payoutPerUnitCents,
              payoutPercentage: props.payoutPercentage,
              currency: props.currency,
            })}
          />
          <Row label="Currency" value={props.currency} />
          <Row
            label="Enrollment Policy"
            value={humanize(props.enrollmentPolicy)}
          />
        </Section>

        <Section title="Targeting">
          <Row
            label="Landing URL"
            value={props.landingUrl ?? "\u2014"}
            truncate
          />
          <Row
            label="Geo Targets"
            value={
              props.geoTargets.length > 0 ? props.geoTargets.join(", ") : "All"
            }
          />
          <Row
            label="Categories"
            value={
              props.categories.length > 0
                ? props.categories.join(", ")
                : "None"
            }
          />
        </Section>

        <Section title="Verification & Hold">
          <Row
            label="Requires Verification"
            value={props.requiresVerification ? "Yes" : "No"}
          />
          <Row
            label="Holding Period"
            value={formatHoldingPeriodDays(props.holdingPeriodDays)}
          />
        </Section>

        <Section title="Limits">
          <Row
            label="Total Budget"
            value={formatCents(props.budgetCents, props.currency)}
          />
          <Row
            label="Daily Lead Cap"
            value={
              props.dailyCapCount != null
                ? props.dailyCapCount.toLocaleString()
                : "No limit"
            }
          />
          <Row
            label="Daily Spend Cap"
            value={
              props.dailyCapCents != null
                ? formatCents(props.dailyCapCents, props.currency)
                : "No limit"
            }
          />
        </Section>

        {hasBuyerIncentive && (
          <Section title="Buyer Incentive">
            <Row
              label="Type"
              value={
                props.buyerIncentiveType
                  ? humanize(props.buyerIncentiveType)
                  : "\u2014"
              }
            />
            <Row
              label="Value"
              value={props.buyerIncentiveValue ?? "\u2014"}
            />
            <Row
              label="Label"
              value={props.buyerIncentiveLabel ?? "\u2014"}
            />
            <Row
              label="Coupon Code"
              value={props.buyerCouponCode ?? "\u2014"}
            />
          </Section>
        )}

        <Section title="Platform">
          <Row
            label="Platform Fee"
            value={`${formatPercent(props.platformFeeRate)} on verified conversions`}
          />
          <Row label="Created" value={formatDate(props.createdAt)} />
          <Row label="Last Modified" value={formatDate(props.updatedAt)} />
        </Section>
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        {children}
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
  truncate,
}: {
  label: string;
  value: ReactNode;
  truncate?: boolean;
}) {
  return (
    <div className={truncate ? "min-w-0" : undefined}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`font-medium ${truncate ? "truncate" : ""}`}>{value}</dd>
    </div>
  );
}

function humanize(enumValue: string): string {
  return enumValue.toLowerCase().replace(/_/g, " ");
}

function compensationModelLabel(model: string): string {
  switch (model) {
    case "CPA":
      return "Flat fee";
    case "REV_SHARE":
      return "Percent of sale";
    case "CPL":
      return "Cost per Lead";
    case "CPC":
      return "Cost per Click";
    default:
      return humanize(model);
  }
}

function formatPercent(rate: number): string {
  const pct = rate * 100;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
