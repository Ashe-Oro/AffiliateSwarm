"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

export default function CreateCampaignPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [compensationModel, setCompensationModel] = useState("CPL");
  const [payoutPerUnitCents, setPayoutPerUnitCents] = useState("");
  const [payoutPercent, setPayoutPercent] = useState("");
  const [budgetCents, setBudgetCents] = useState("");
  const [landingUrl, setLandingUrl] = useState("");
  const [categories, setCategories] = useState("");
  const [geoTargets, setGeoTargets] = useState("");
  const [enrollmentPolicy, setEnrollmentPolicy] = useState("APPROVAL_REQUIRED");
  const [dailyCapCount, setDailyCapCount] = useState("");
  const [dailyCapCents, setDailyCapCents] = useState("");
  const [holdingPeriodDays, setHoldingPeriodDays] = useState("30");
  const [requiresVerification, setRequiresVerification] = useState(true);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [hasBuyerIncentive, setHasBuyerIncentive] = useState(false);
  const [buyerIncentiveType, setBuyerIncentiveType] = useState("PERCENTAGE_OFF");
  const [buyerIncentiveValue, setBuyerIncentiveValue] = useState("");
  const [buyerIncentiveLabel, setBuyerIncentiveLabel] = useState("");
  const [buyerCouponCode, setBuyerCouponCode] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const isRevShare = compensationModel === "REV_SHARE";
      const body: Record<string, unknown> = {
        name,
        description: description || undefined,
        compensationModel,
        currency: "USD",
        budgetCents: Math.round(parseFloat(budgetCents) * 100),
        landingUrl: landingUrl || undefined,
        categories: categories
          ? categories.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        geoTargets: geoTargets
          ? geoTargets.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
          : [],
        enrollmentPolicy,
        holdingPeriodDays: parseInt(holdingPeriodDays, 10),
        requiresVerification,
        ...(dailyCapCount
          ? { dailyCapCount: parseInt(dailyCapCount, 10) }
          : {}),
        ...(dailyCapCents
          ? { dailyCapCents: Math.round(parseFloat(dailyCapCents) * 100) }
          : {}),
        ...(startsAt ? { startsAt } : {}),
        ...(endsAt ? { endsAt } : {}),
        ...(hasBuyerIncentive
          ? {
              buyerIncentiveType,
              buyerIncentiveValue: buyerIncentiveValue || undefined,
              buyerIncentiveLabel: buyerIncentiveLabel || undefined,
              buyerCouponCode: buyerCouponCode || undefined,
            }
          : {}),
      };

      if (isRevShare) {
        const pct = parseInt(payoutPercent, 10);
        if (!Number.isFinite(pct) || pct < 1 || pct > 100) {
          throw new Error("Percent of sale must be a whole number between 1 and 100");
        }
        body.payoutPercentage = pct;
      } else {
        const cents = Math.round(parseFloat(payoutPerUnitCents) * 100);
        if (!Number.isFinite(cents) || cents <= 0) {
          throw new Error("Payout must be a positive number");
        }
        body.payoutPerUnitCents = cents;
      }
      const budget = body.budgetCents as number;
      if (!Number.isFinite(budget) || budget <= 0) {
        throw new Error("Budget must be a positive number");
      }

      const res = await fetch("/api/dashboard/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg =
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? "Failed to create campaign";
        throw new Error(msg);
      }

      const data = await res.json();
      const campaignId = data.data?.campaign?.id;
      if (!campaignId) {
        throw new Error(
          "Campaign created, but we could not open it automatically. Visit your campaigns list."
        );
      }
      router.push(`/dashboard/campaigns/${campaignId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Create Campaign</h2>

      <Card>
        <CardHeader>
          <CardTitle>Campaign Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Campaign"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your campaign..."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="compensationModel">Compensation Model</Label>
                <Select
                  id="compensationModel"
                  value={compensationModel}
                  onChange={(e) => setCompensationModel(e.target.value)}
                >
                  <option value="CPL">CPL (Cost Per Lead)</option>
                  <option value="CPA">Flat fee (fixed $ per conversion)</option>
                  <option value="CPC">CPC (Cost Per Click)</option>
                  <option value="REV_SHARE">Percent of sale (% of initial sale)</option>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="enrollmentPolicy">Enrollment Policy</Label>
                <Select
                  id="enrollmentPolicy"
                  value={enrollmentPolicy}
                  onChange={(e) => setEnrollmentPolicy(e.target.value)}
                >
                  <option value="OPEN">Open</option>
                  <option value="APPROVAL_REQUIRED">Approval Required</option>
                  <option value="INVITE_ONLY">Invite Only</option>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {compensationModel === "REV_SHARE" ? (
                <div className="space-y-2">
                  <Label htmlFor="payoutPercent">Percent of initial sale (%)</Label>
                  <Input
                    id="payoutPercent"
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    value={payoutPercent}
                    onChange={(e) => setPayoutPercent(e.target.value)}
                    placeholder="20"
                    required
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="payoutPerUnitCents">Payout per Unit ($)</Label>
                  <Input
                    id="payoutPerUnitCents"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={payoutPerUnitCents}
                    onChange={(e) => setPayoutPerUnitCents(e.target.value)}
                    placeholder="5.00"
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="budgetCents">Budget ($)</Label>
                <Input
                  id="budgetCents"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={budgetCents}
                  onChange={(e) => setBudgetCents(e.target.value)}
                  placeholder="1000.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  value="USD"
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="landingUrl">Landing URL</Label>
              <Input
                id="landingUrl"
                type="url"
                value={landingUrl}
                onChange={(e) => setLandingUrl(e.target.value)}
                placeholder="https://example.com/offer"
              />
            </div>

            <div className="space-y-3 rounded-md border p-4">
              <div className="flex items-center gap-2">
                <input
                  id="hasBuyerIncentive"
                  type="checkbox"
                  checked={hasBuyerIncentive}
                  onChange={(e) => setHasBuyerIncentive(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <Label htmlFor="hasBuyerIncentive">
                  Offer a buyer incentive (discount/promo for referred users)
                </Label>
              </div>

              {hasBuyerIncentive && (
                <div className="space-y-4 pt-2">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="buyerIncentiveType">Incentive Type</Label>
                      <Select
                        id="buyerIncentiveType"
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
                      <Label htmlFor="buyerIncentiveValue">
                        {incentiveValueLabel(buyerIncentiveType)}
                      </Label>
                      <Input
                        id="buyerIncentiveValue"
                        value={buyerIncentiveValue}
                        onChange={(e) => setBuyerIncentiveValue(e.target.value)}
                        placeholder={incentiveValuePlaceholder(buyerIncentiveType)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="buyerIncentiveLabel">
                      Display Label (what affiliates will promote)
                    </Label>
                    <Input
                      id="buyerIncentiveLabel"
                      value={buyerIncentiveLabel}
                      onChange={(e) => setBuyerIncentiveLabel(e.target.value)}
                      placeholder="20% off your first month"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="buyerCouponCode">
                      Coupon Code (the promo code in your payment system)
                    </Label>
                    <Input
                      id="buyerCouponCode"
                      value={buyerCouponCode}
                      onChange={(e) => setBuyerCouponCode(e.target.value)}
                      placeholder="REGATTA20"
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="categories">Categories (comma-separated)</Label>
                <Input
                  id="categories"
                  value={categories}
                  onChange={(e) => setCategories(e.target.value)}
                  placeholder="finance, insurance"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="geoTargets">
                  Geo Targets (comma-separated)
                </Label>
                <Input
                  id="geoTargets"
                  value={geoTargets}
                  onChange={(e) => setGeoTargets(e.target.value)}
                  placeholder="US, CA, GB"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="holdingPeriodDays">
                Holding Period (days)
              </Label>
              <Input
                id="holdingPeriodDays"
                type="number"
                min="0"
                max="90"
                value={holdingPeriodDays}
                onChange={(e) => setHoldingPeriodDays(e.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dailyCapCount">
                  Daily Cap (count, optional)
                </Label>
                <Input
                  id="dailyCapCount"
                  type="number"
                  min="1"
                  value={dailyCapCount}
                  onChange={(e) => setDailyCapCount(e.target.value)}
                  placeholder="No limit"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dailyCapCents">
                  Daily Cap ($, optional)
                </Label>
                <Input
                  id="dailyCapCents"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={dailyCapCents}
                  onChange={(e) => setDailyCapCents(e.target.value)}
                  placeholder="No limit"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startsAt">Start Date (optional)</Label>
                <Input
                  id="startsAt"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endsAt">End Date (optional)</Label>
                <Input
                  id="endsAt"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="requiresVerification"
                type="checkbox"
                checked={requiresVerification}
                onChange={(e) => setRequiresVerification(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="requiresVerification">
                Requires Verification
              </Label>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Campaign"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
