"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

function incentiveValueLabel(type: string): string {
  switch (type) {
    case "PERCENTAGE_OFF":
      return "Discount (%)";
    case "FIXED_AMOUNT_OFF":
      return "Discount Amount ($)";
    case "FREE_TRIAL":
      return "Trial Duration (days)";
    default:
      return "Value";
  }
}

function incentiveValuePlaceholder(type: string): string {
  switch (type) {
    case "PERCENTAGE_OFF":
      return "20";
    case "FIXED_AMOUNT_OFF":
      return "10.00";
    case "FREE_TRIAL":
      return "30";
    default:
      return "Describe the incentive";
  }
}

interface EditCampaignFormProps {
  campaignId: string;
  initial: {
    name: string;
    description: string | null;
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
    buyerIncentiveType: string | null;
    buyerIncentiveValue: string | null;
    buyerIncentiveLabel: string | null;
    buyerCouponCode: string | null;
  };
  onClose: () => void;
}

export function EditCampaignForm({
  campaignId,
  initial,
  onClose,
}: EditCampaignFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const isRevShare = initial.compensationModel === "REV_SHARE";
  const [payoutPerUnitCents, setPayoutPerUnitCents] = useState(
    initial.payoutPerUnitCents != null
      ? (initial.payoutPerUnitCents / 100).toFixed(2)
      : ""
  );
  const [payoutPercentage, setPayoutPercentage] = useState(
    initial.payoutPercentage != null ? String(initial.payoutPercentage) : ""
  );
  const [budgetCents, setBudgetCents] = useState(
    (initial.budgetCents / 100).toFixed(2)
  );
  const [landingUrl, setLandingUrl] = useState(initial.landingUrl ?? "");
  const [categories, setCategories] = useState(initial.categories.join(", "));
  const [geoTargets, setGeoTargets] = useState(initial.geoTargets.join(", "));
  const [enrollmentPolicy, setEnrollmentPolicy] = useState(
    initial.enrollmentPolicy
  );
  const [holdingPeriodDays, setHoldingPeriodDays] = useState(
    String(initial.holdingPeriodDays)
  );
  const [dailyCapCount, setDailyCapCount] = useState(
    initial.dailyCapCount != null ? String(initial.dailyCapCount) : ""
  );
  const [dailyCapCents, setDailyCapCents] = useState(
    initial.dailyCapCents != null
      ? (initial.dailyCapCents / 100).toFixed(2)
      : ""
  );
  const [requiresVerification, setRequiresVerification] = useState(
    initial.requiresVerification
  );
  const [hasBuyerIncentive, setHasBuyerIncentive] = useState(
    !!(initial.buyerIncentiveType || initial.buyerIncentiveLabel || initial.buyerCouponCode)
  );
  const [buyerIncentiveType, setBuyerIncentiveType] = useState(
    initial.buyerIncentiveType ?? "PERCENTAGE_OFF"
  );
  const [buyerIncentiveValue, setBuyerIncentiveValue] = useState(
    initial.buyerIncentiveValue ?? ""
  );
  const [buyerIncentiveLabel, setBuyerIncentiveLabel] = useState(
    initial.buyerIncentiveLabel ?? ""
  );
  const [buyerCouponCode, setBuyerCouponCode] = useState(
    initial.buyerCouponCode ?? ""
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        name,
        description: description || null,
        budgetCents: Math.round(parseFloat(budgetCents) * 100),
        landingUrl: landingUrl || null,
        categories: categories
          ? categories
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        geoTargets: geoTargets
          ? geoTargets
              .split(",")
              .map((s) => s.trim().toUpperCase())
              .filter(Boolean)
          : [],
        enrollmentPolicy,
        holdingPeriodDays: parseInt(holdingPeriodDays, 10),
        requiresVerification,
      };

      if (isRevShare) {
        const pct = parseInt(payoutPercentage, 10);
        if (!Number.isFinite(pct) || pct < 1 || pct > 100) {
          throw new Error("Percent of sale must be a whole number between 1 and 100");
        }
        body.payoutPercentage = pct;
      } else {
        body.payoutPerUnitCents = Math.round(
          parseFloat(payoutPerUnitCents) * 100
        );
      }

      if (dailyCapCount) {
        body.dailyCapCount = parseInt(dailyCapCount, 10);
      } else {
        body.dailyCapCount = null;
      }

      if (dailyCapCents) {
        body.dailyCapCents = Math.round(parseFloat(dailyCapCents) * 100);
      } else {
        body.dailyCapCents = null;
      }

      if (hasBuyerIncentive) {
        body.buyerIncentiveType = buyerIncentiveType;
        body.buyerIncentiveValue = buyerIncentiveValue || null;
        body.buyerIncentiveLabel = buyerIncentiveLabel || null;
        body.buyerCouponCode = buyerCouponCode || null;
      } else {
        body.buyerIncentiveType = null;
        body.buyerIncentiveValue = null;
        body.buyerIncentiveLabel = null;
        body.buyerCouponCode = null;
      }

      const res = await fetch(`/api/dashboard/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.error?.message ?? "Failed to update campaign"
        );
      }

      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="edit-name">Name</Label>
        <Input
          id="edit-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-description">Description</Label>
        <Textarea
          id="edit-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {isRevShare ? (
          <div className="space-y-2">
            <Label htmlFor="edit-payout-percentage">Percent of initial sale (%)</Label>
            <Input
              id="edit-payout-percentage"
              type="number"
              min="1"
              max="100"
              step="1"
              value={payoutPercentage}
              onChange={(e) => setPayoutPercentage(e.target.value)}
              required
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="edit-payout">Payout per Unit ($)</Label>
            <Input
              id="edit-payout"
              type="number"
              min="0.01"
              step="0.01"
              value={payoutPerUnitCents}
              onChange={(e) => setPayoutPerUnitCents(e.target.value)}
              required
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="edit-budget">Budget ($)</Label>
          <Input
            id="edit-budget"
            type="number"
            min="0.01"
            step="0.01"
            value={budgetCents}
            onChange={(e) => setBudgetCents(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="edit-enrollment">Enrollment Policy</Label>
          <Select
            id="edit-enrollment"
            value={enrollmentPolicy}
            onChange={(e) => setEnrollmentPolicy(e.target.value)}
          >
            <option value="OPEN">Open</option>
            <option value="APPROVAL_REQUIRED">Approval Required</option>
            <option value="INVITE_ONLY">Invite Only</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-landing">Landing URL</Label>
          <Input
            id="edit-landing"
            type="url"
            value={landingUrl}
            onChange={(e) => setLandingUrl(e.target.value)}
            placeholder="https://example.com/offer"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="edit-categories">Categories (comma-separated)</Label>
          <Input
            id="edit-categories"
            value={categories}
            onChange={(e) => setCategories(e.target.value)}
            placeholder="finance, insurance"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-geo">Geo Targets (comma-separated)</Label>
          <Input
            id="edit-geo"
            value={geoTargets}
            onChange={(e) => setGeoTargets(e.target.value)}
            placeholder="US, CA, GB"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-holding">Holding Period (days)</Label>
        <Input
          id="edit-holding"
          type="number"
          min="0"
          max="90"
          value={holdingPeriodDays}
          onChange={(e) => setHoldingPeriodDays(e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="edit-daily-cap-count">
            Daily Cap (count, optional)
          </Label>
          <Input
            id="edit-daily-cap-count"
            type="number"
            min="1"
            value={dailyCapCount}
            onChange={(e) => setDailyCapCount(e.target.value)}
            placeholder="No limit"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-daily-cap-cents">
            Daily Cap ($, optional)
          </Label>
          <Input
            id="edit-daily-cap-cents"
            type="number"
            min="0.01"
            step="0.01"
            value={dailyCapCents}
            onChange={(e) => setDailyCapCents(e.target.value)}
            placeholder="No limit"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="edit-verification"
          type="checkbox"
          checked={requiresVerification}
          onChange={(e) => setRequiresVerification(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        <Label htmlFor="edit-verification">Requires Verification</Label>
      </div>

      <div className="space-y-3 rounded-md border p-4">
        <div className="flex items-center gap-2">
          <input
            id="edit-hasBuyerIncentive"
            type="checkbox"
            checked={hasBuyerIncentive}
            onChange={(e) => setHasBuyerIncentive(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <Label htmlFor="edit-hasBuyerIncentive">
            Offer a buyer incentive (discount/promo for referred users)
          </Label>
        </div>

        {hasBuyerIncentive && (
          <div className="space-y-4 pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-buyerIncentiveType">Incentive Type</Label>
                <Select
                  id="edit-buyerIncentiveType"
                  value={buyerIncentiveType}
                  onChange={(e) => setBuyerIncentiveType(e.target.value)}
                >
                  <option value="PERCENTAGE_OFF">Percentage Off</option>
                  <option value="FIXED_AMOUNT_OFF">Fixed Amount Off</option>
                  <option value="FREE_TRIAL">Free Trial</option>
                  <option value="CUSTOM">Custom</option>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-buyerIncentiveValue">
                  {incentiveValueLabel(buyerIncentiveType)}
                </Label>
                <Input
                  id="edit-buyerIncentiveValue"
                  value={buyerIncentiveValue}
                  onChange={(e) => setBuyerIncentiveValue(e.target.value)}
                  placeholder={incentiveValuePlaceholder(buyerIncentiveType)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-buyerIncentiveLabel">
                Display Label (what affiliates will promote)
              </Label>
              <Input
                id="edit-buyerIncentiveLabel"
                value={buyerIncentiveLabel}
                onChange={(e) => setBuyerIncentiveLabel(e.target.value)}
                placeholder="20% off your first month"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-buyerCouponCode">
                Coupon Code (the promo code in your payment system)
              </Label>
              <Input
                id="edit-buyerCouponCode"
                value={buyerCouponCode}
                onChange={(e) => setBuyerCouponCode(e.target.value)}
                placeholder="SWARM20"
              />
              <p className="text-xs text-muted-foreground">
                This code will be appended to affiliate tracking URLs as{" "}
                <code className="rounded bg-muted px-1">?promo=CODE</code>{" "}
                so your site can auto-apply the discount.
              </p>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save Changes"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
