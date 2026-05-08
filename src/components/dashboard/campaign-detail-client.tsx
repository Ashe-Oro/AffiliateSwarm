"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CampaignActions } from "@/components/dashboard/campaign-actions";
import { EditCampaignForm } from "@/components/dashboard/edit-campaign-form";

function statusVariant(status: string) {
  switch (status) {
    case "ACTIVE":
      return "default" as const;
    case "PAUSED":
      return "secondary" as const;
    case "DRAFT":
      return "outline" as const;
    default:
      return "outline" as const;
  }
}

interface CampaignData {
  id: string;
  name: string;
  description: string | null;
  status: string;
  compensationModel: string;
  payoutPerUnitCents: number | null;
  payoutPercentage: number | null;
  budgetCents: number;
  landingUrl: string | null;
  categories: string[];
  geoTargets: string[];
  enrollmentPolicy: string;
  holdingPeriodDays: number;
  dailyCapCount: number | null;
  dailyCapCents: number | null;
  requiresVerification: boolean;
  trackingConfirmedAt: string | null;
  buyerIncentiveType: string | null;
  buyerIncentiveValue: string | null;
  buyerIncentiveLabel: string | null;
  buyerCouponCode: string | null;
}

interface CampaignDetailClientProps {
  campaign: CampaignData;
  readOnly?: boolean;
}

export function CampaignDetailClient({
  campaign,
  readOnly = false,
}: CampaignDetailClientProps) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">
              {campaign.name}
            </h2>
            <Badge variant={statusVariant(campaign.status)}>
              {campaign.status.toLowerCase().replace(/_/g, " ")}
            </Badge>
          </div>
          {campaign.description && (
            <p className="text-sm text-muted-foreground">
              {campaign.description}
            </p>
          )}
        </div>
        {!readOnly && (
          <CampaignActions
            campaignId={campaign.id}
            status={campaign.status}
            trackingConfirmed={!!campaign.trackingConfirmedAt}
            onEditClick={() => setEditing(true)}
          />
        )}
      </div>

      {!readOnly && editing && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Campaign</CardTitle>
          </CardHeader>
          <CardContent>
            <EditCampaignForm
              campaignId={campaign.id}
              initial={{
                name: campaign.name,
                description: campaign.description,
                compensationModel: campaign.compensationModel,
                payoutPerUnitCents: campaign.payoutPerUnitCents,
                payoutPercentage: campaign.payoutPercentage,
                budgetCents: campaign.budgetCents,
                landingUrl: campaign.landingUrl,
                categories: campaign.categories,
                geoTargets: campaign.geoTargets,
                enrollmentPolicy: campaign.enrollmentPolicy,
                holdingPeriodDays: campaign.holdingPeriodDays,
                dailyCapCount: campaign.dailyCapCount,
                dailyCapCents: campaign.dailyCapCents,
                requiresVerification: campaign.requiresVerification,
                buyerIncentiveType: campaign.buyerIncentiveType,
                buyerIncentiveValue: campaign.buyerIncentiveValue,
                buyerIncentiveLabel: campaign.buyerIncentiveLabel,
                buyerCouponCode: campaign.buyerCouponCode,
              }}
              onClose={() => setEditing(false)}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}
