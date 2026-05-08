import { describe, it, expect } from "vitest";

import {
  CreateCampaignSchema,
  UpdateCampaignSchema,
  DiscoverCampaignsSchema,
  ApplyToCampaignSchema,
} from "@/lib/validators/campaign";

// ---------------------------------------------------------------------------
// 1. CreateCampaignSchema
// ---------------------------------------------------------------------------

describe("CreateCampaignSchema", () => {
  const validInput = {
    name: "Summer Lead Gen",
    compensationModel: "CPL" as const,
    payoutPerUnitCents: 500,
    budgetCents: 100000,
  };

  it("accepts valid minimal input and applies defaults", () => {
    const result = CreateCampaignSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("USD");
      expect(result.data.enrollmentPolicy).toBe("APPROVAL_REQUIRED");
      expect(result.data.requiresVerification).toBe(true);
    }
  });

  it("accepts valid input with all optional fields", () => {
    const result = CreateCampaignSchema.safeParse({
      ...validInput,
      description: "A great campaign",
      currency: "EUR",
      dailyCapCount: 100,
      dailyCapCents: 50000,
      geoTargets: ["US", "GB"],
      categories: ["finance", "insurance"],
      landingUrl: "https://example.com/landing",
      enrollmentPolicy: "OPEN",
      requiresVerification: false,
      leadRequirements: { minAge: 18 },
      targetingCriteria: { vertical: "finance" },
      startsAt: "2026-04-01T00:00:00Z",
      endsAt: "2026-06-01T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const { name, ...rest } = validInput;
    const result = CreateCampaignSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = CreateCampaignSchema.safeParse({ ...validInput, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name exceeding 255 characters", () => {
    const result = CreateCampaignSchema.safeParse({
      ...validInput,
      name: "x".repeat(256),
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing compensationModel", () => {
    const { compensationModel, ...rest } = validInput;
    const result = CreateCampaignSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects zero payoutPerUnitCents", () => {
    const result = CreateCampaignSchema.safeParse({
      ...validInput,
      payoutPerUnitCents: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative budgetCents", () => {
    const result = CreateCampaignSchema.safeParse({
      ...validInput,
      budgetCents: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer payoutPerUnitCents", () => {
    const result = CreateCampaignSchema.safeParse({
      ...validInput,
      payoutPerUnitCents: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects currency that is not exactly 3 characters", () => {
    const result = CreateCampaignSchema.safeParse({
      ...validInput,
      currency: "US",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid landingUrl", () => {
    const result = CreateCampaignSchema.safeParse({
      ...validInput,
      landingUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects geoTargets with wrong-length codes", () => {
    const result = CreateCampaignSchema.safeParse({
      ...validInput,
      geoTargets: ["USA"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid enrollmentPolicy", () => {
    const result = CreateCampaignSchema.safeParse({
      ...validInput,
      enrollmentPolicy: "ANYONE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects description exceeding 5000 characters", () => {
    const result = CreateCampaignSchema.safeParse({
      ...validInput,
      description: "x".repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  // -- REV_SHARE / payoutPercentage -------------------------------------------

  const revShareInput = {
    name: "Rude Mugs",
    compensationModel: "REV_SHARE" as const,
    payoutPercentage: 20,
    budgetCents: 200000,
  };

  it("REV_SHARE: accepts payoutPercentage without payoutPerUnitCents", () => {
    const result = CreateCampaignSchema.safeParse(revShareInput);
    expect(result.success).toBe(true);
  });

  it("REV_SHARE: rejects missing payoutPercentage", () => {
    const { payoutPercentage, ...rest } = revShareInput;
    const result = CreateCampaignSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("REV_SHARE: rejects payoutPercentage above 100", () => {
    const result = CreateCampaignSchema.safeParse({
      ...revShareInput,
      payoutPercentage: 101,
    });
    expect(result.success).toBe(false);
  });

  it("REV_SHARE: rejects payoutPercentage below 1", () => {
    const result = CreateCampaignSchema.safeParse({
      ...revShareInput,
      payoutPercentage: 0,
    });
    expect(result.success).toBe(false);
  });

  it("REV_SHARE: rejects also setting payoutPerUnitCents", () => {
    const result = CreateCampaignSchema.safeParse({
      ...revShareInput,
      payoutPerUnitCents: 500,
    });
    expect(result.success).toBe(false);
  });

  it("CPL: rejects payoutPercentage when compensationModel is not REV_SHARE", () => {
    const result = CreateCampaignSchema.safeParse({
      ...validInput,
      payoutPercentage: 10,
    });
    expect(result.success).toBe(false);
  });

  it("CPL: rejects missing payoutPerUnitCents", () => {
    const { payoutPerUnitCents, ...rest } = validInput;
    const result = CreateCampaignSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("accepts new campaign product fields", () => {
    const result = CreateCampaignSchema.safeParse({
      ...validInput,
      productUrl: "https://myproduct.com",
      conversionAction: "paid_subscription",
      productDescription: "A SaaS product for developers",
      brandAssets: { logoUrl: "https://myproduct.com/logo.png" },
    });
    expect(result.success).toBe(true);
  });

  // -- Buyer incentive fields ---------------------------------------------------

  it("accepts all buyer incentive fields", () => {
    const result = CreateCampaignSchema.safeParse({
      ...validInput,
      buyerIncentiveType: "PERCENTAGE_OFF",
      buyerIncentiveValue: "20",
      buyerIncentiveLabel: "20% off your first month",
      buyerCouponCode: "SWARM20",
    });
    expect(result.success).toBe(true);
  });

  it.each([
    ["PERCENTAGE_OFF", "20"],
    ["FIXED_AMOUNT_OFF", "10"],
    ["FREE_TRIAL", "30"],
    ["CUSTOM", "Buy one get one"],
  ] as const)("accepts %s with a valid value", (type, value) => {
    const result = CreateCampaignSchema.safeParse({
      ...validInput,
      buyerIncentiveType: type,
      buyerIncentiveValue: value,
    });
    expect(result.success).toBe(true);
  });

  it("accepts CUSTOM type without an explicit value", () => {
    const result = CreateCampaignSchema.safeParse({
      ...validInput,
      buyerIncentiveType: "CUSTOM",
    });
    expect(result.success).toBe(true);
  });

  it.each(["PERCENTAGE_OFF", "FIXED_AMOUNT_OFF", "FREE_TRIAL"] as const)(
    "rejects %s without a value",
    (type) => {
      const result = CreateCampaignSchema.safeParse({
        ...validInput,
        buyerIncentiveType: type,
      });
      expect(result.success).toBe(false);
    }
  );

  it.each([
    ["PERCENTAGE_OFF", "twenty"],
    ["PERCENTAGE_OFF", "0"],
    ["PERCENTAGE_OFF", "150"],
    ["FIXED_AMOUNT_OFF", "free"],
    ["FIXED_AMOUNT_OFF", "0"],
    ["FREE_TRIAL", "1.5"],
    ["FREE_TRIAL", "-7"],
  ] as const)("rejects %s with invalid value %s", (type, value) => {
    const result = CreateCampaignSchema.safeParse({
      ...validInput,
      buyerIncentiveType: type,
      buyerIncentiveValue: value,
    });
    expect(result.success).toBe(false);
  });

  it.each(["BAD CODE", "code!", "promo$20", "spaces here"])(
    "rejects buyerCouponCode with disallowed characters: %s",
    (code) => {
      const result = CreateCampaignSchema.safeParse({
        ...validInput,
        buyerCouponCode: code,
      });
      expect(result.success).toBe(false);
    }
  );

  it("accepts buyerCouponCode with letters, numbers, underscore, hyphen", () => {
    const result = CreateCampaignSchema.safeParse({
      ...validInput,
      buyerCouponCode: "SWARM_20-OFF",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid buyerIncentiveType", () => {
    const result = CreateCampaignSchema.safeParse({
      ...validInput,
      buyerIncentiveType: "BOGO",
    });
    expect(result.success).toBe(false);
  });

  it("rejects buyerIncentiveValue exceeding 255 characters", () => {
    const result = CreateCampaignSchema.safeParse({
      ...validInput,
      buyerIncentiveValue: "x".repeat(256),
    });
    expect(result.success).toBe(false);
  });

  it("rejects buyerIncentiveLabel exceeding 255 characters", () => {
    const result = CreateCampaignSchema.safeParse({
      ...validInput,
      buyerIncentiveLabel: "x".repeat(256),
    });
    expect(result.success).toBe(false);
  });

  it("rejects buyerCouponCode exceeding 100 characters", () => {
    const result = CreateCampaignSchema.safeParse({
      ...validInput,
      buyerCouponCode: "x".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid productUrl", () => {
    const result = CreateCampaignSchema.safeParse({
      ...validInput,
      productUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects productDescription exceeding 5000 characters", () => {
    const result = CreateCampaignSchema.safeParse({
      ...validInput,
      productDescription: "x".repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects conversionAction exceeding 100 characters", () => {
    const result = CreateCampaignSchema.safeParse({
      ...validInput,
      conversionAction: "x".repeat(101),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Compensation model validation
// ---------------------------------------------------------------------------

describe("Compensation model validation", () => {
  const base = {
    name: "Test",
    budgetCents: 10000,
  };

  it.each(["CPL", "CPA", "CPC"] as const)(
    "accepts %s with payoutPerUnitCents",
    (model) => {
      const result = CreateCampaignSchema.safeParse({
        ...base,
        compensationModel: model,
        payoutPerUnitCents: 100,
      });
      expect(result.success).toBe(true);
    }
  );

  it("accepts REV_SHARE with payoutPercentage", () => {
    const result = CreateCampaignSchema.safeParse({
      ...base,
      compensationModel: "REV_SHARE",
      payoutPercentage: 20,
    });
    expect(result.success).toBe(true);
  });

  it.each(["cpl", "RevShare", "FLAT_RATE", ""])(
    "rejects %s as an invalid compensationModel",
    (model) => {
      const result = CreateCampaignSchema.safeParse({
        ...base,
        compensationModel: model,
      });
      expect(result.success).toBe(false);
    }
  );
});

// ---------------------------------------------------------------------------
// 3. UpdateCampaignSchema
// ---------------------------------------------------------------------------

describe("UpdateCampaignSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    const result = UpdateCampaignSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a partial update with only name", () => {
    const result = UpdateCampaignSchema.safeParse({ name: "Updated Name" });
    expect(result.success).toBe(true);
  });

  it("accepts null for nullish fields", () => {
    const result = UpdateCampaignSchema.safeParse({
      description: null,
      dailyCapCount: null,
      landingUrl: null,
      leadRequirements: null,
      startsAt: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = UpdateCampaignSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects zero budgetCents", () => {
    const result = UpdateCampaignSchema.safeParse({ budgetCents: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid landingUrl", () => {
    const result = UpdateCampaignSchema.safeParse({
      landingUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("accepts nullish product fields for clearing", () => {
    const result = UpdateCampaignSchema.safeParse({
      productUrl: null,
      conversionAction: null,
      productDescription: null,
      brandAssets: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts updating product fields", () => {
    const result = UpdateCampaignSchema.safeParse({
      productUrl: "https://updated.com",
      conversionAction: "free_signup",
      productDescription: "Updated description",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid productUrl in update", () => {
    const result = UpdateCampaignSchema.safeParse({
      productUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  // -- Buyer incentive fields (update) ------------------------------------------

  it("accepts updating buyer incentive fields", () => {
    const result = UpdateCampaignSchema.safeParse({
      buyerIncentiveType: "FIXED_AMOUNT_OFF",
      buyerIncentiveValue: "10.00",
      buyerIncentiveLabel: "$10 off your first purchase",
      buyerCouponCode: "SAVE10",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null for buyer incentive fields (clearing)", () => {
    const result = UpdateCampaignSchema.safeParse({
      buyerIncentiveType: null,
      buyerIncentiveValue: null,
      buyerIncentiveLabel: null,
      buyerCouponCode: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid buyerIncentiveType in update", () => {
    const result = UpdateCampaignSchema.safeParse({
      buyerIncentiveType: "INVALID_TYPE",
    });
    expect(result.success).toBe(false);
  });

  // -- Payout field XOR (update) ------------------------------------------------

  it("rejects updating both payoutPerUnitCents and payoutPercentage in the same request", () => {
    const result = UpdateCampaignSchema.safeParse({
      payoutPerUnitCents: 500,
      payoutPercentage: 20,
    });
    expect(result.success).toBe(false);
  });

  it("accepts updating only payoutPerUnitCents (for fixed-payout campaigns)", () => {
    const result = UpdateCampaignSchema.safeParse({
      payoutPerUnitCents: 500,
    });
    expect(result.success).toBe(true);
  });

  it("accepts updating only payoutPercentage (for REV_SHARE campaigns)", () => {
    const result = UpdateCampaignSchema.safeParse({
      payoutPercentage: 20,
    });
    expect(result.success).toBe(true);
  });

  it("rejects payoutPercentage above 100 in update", () => {
    const result = UpdateCampaignSchema.safeParse({
      payoutPercentage: 101,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. DiscoverCampaignsSchema
// ---------------------------------------------------------------------------

describe("DiscoverCampaignsSchema", () => {
  it("accepts empty object and applies defaults", () => {
    const result = DiscoverCampaignsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it("accepts all optional filter fields", () => {
    const result = DiscoverCampaignsSchema.safeParse({
      compensationModel: "CPA",
      category: "finance",
      geo: "US",
      query: "lead gen",
      page: 2,
      pageSize: 50,
    });
    expect(result.success).toBe(true);
  });

  it("rejects pageSize > 100", () => {
    const result = DiscoverCampaignsSchema.safeParse({ pageSize: 101 });
    expect(result.success).toBe(false);
  });

  it("rejects page < 1", () => {
    const result = DiscoverCampaignsSchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects geo code that is not 2 characters", () => {
    const result = DiscoverCampaignsSchema.safeParse({ geo: "USA" });
    expect(result.success).toBe(false);
  });

  it("rejects query exceeding 255 characters", () => {
    const result = DiscoverCampaignsSchema.safeParse({
      query: "x".repeat(256),
    });
    expect(result.success).toBe(false);
  });

  it("coerces string page to number", () => {
    const result = DiscoverCampaignsSchema.safeParse({ page: "3" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. ApplyToCampaignSchema
// ---------------------------------------------------------------------------

describe("ApplyToCampaignSchema", () => {
  it("accepts empty object (all fields optional)", () => {
    const result = ApplyToCampaignSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts valid pitch and customTerms", () => {
    const result = ApplyToCampaignSchema.safeParse({
      pitch: "I have 50k monthly visitors in the finance niche.",
      customTerms: { exclusiveGeo: "US" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects pitch exceeding 5000 characters", () => {
    const result = ApplyToCampaignSchema.safeParse({
      pitch: "x".repeat(5001),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. Campaign status transitions (service-level logic, mocked DB)
// ---------------------------------------------------------------------------

import { vi, beforeEach } from "vitest";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from "@/lib/errors";

// Mock prisma before importing the service
vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaign: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    wallet: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/services/notification.service", () => ({
  notify: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { notify } from "@/services/notification.service";
import {
  pauseCampaign,
  resumeCampaign,
  updateCampaign,
  deleteCampaign,
  discoverCampaigns,
  computeAdvertiserBudgetCoverage,
} from "@/services/campaign.service";

const mockFindFirst = prisma.campaign.findFirst as ReturnType<typeof vi.fn>;
const mockUpdate = prisma.campaign.update as ReturnType<typeof vi.fn>;

describe("Campaign status transitions", () => {
  const ownerId = "owner-1";

  beforeEach(() => {
    vi.clearAllMocks();
    // Default the oversubscription-check queries to "nothing active, no wallet"
    // so resumeCampaign/activateCampaign tests don't trip over missing mocks.
    // Individual tests that care about the coverage check can override.
    (prisma.campaign.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.wallet.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  // -- pause: ACTIVE -> PAUSED -------------------------------------------------

  describe("pauseCampaign", () => {
    it("transitions an ACTIVE campaign to PAUSED", async () => {
      mockFindFirst.mockResolvedValue({
        id: "c1",
        advertiserId: ownerId,
        status: "ACTIVE",
      });
      mockUpdate.mockResolvedValue({ id: "c1", status: "PAUSED" });

      const result = await pauseCampaign("c1", ownerId);
      expect(result.status).toBe("PAUSED");
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "c1" },
        data: { status: "PAUSED" },
      });
    });

    it("throws ValidationError when campaign is not ACTIVE", async () => {
      mockFindFirst.mockResolvedValue({
        id: "c1",
        advertiserId: ownerId,
        status: "DRAFT",
      });

      await expect(pauseCampaign("c1", ownerId)).rejects.toThrow(
        ValidationError
      );
    });

    it("throws NotFoundError when campaign does not exist", async () => {
      mockFindFirst.mockResolvedValue(null);
      await expect(pauseCampaign("missing", ownerId)).rejects.toThrow(
        NotFoundError
      );
    });

    it("throws ForbiddenError when requestor is not the owner", async () => {
      mockFindFirst.mockResolvedValue({
        id: "c1",
        advertiserId: "other-user",
        status: "ACTIVE",
      });

      await expect(pauseCampaign("c1", ownerId)).rejects.toThrow(
        ForbiddenError
      );
    });
  });

  // -- resume: PAUSED -> ACTIVE ------------------------------------------------

  describe("resumeCampaign", () => {
    it("transitions a PAUSED campaign to ACTIVE", async () => {
      mockFindFirst.mockResolvedValue({
        id: "c1",
        advertiserId: ownerId,
        status: "PAUSED",
      });
      mockUpdate.mockResolvedValue({ id: "c1", status: "ACTIVE" });

      const result = await resumeCampaign("c1", ownerId);
      expect(result.status).toBe("ACTIVE");
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "c1" },
        data: { status: "ACTIVE" },
      });
    });

    it("throws ValidationError when campaign is not PAUSED", async () => {
      mockFindFirst.mockResolvedValue({
        id: "c1",
        advertiserId: ownerId,
        status: "ACTIVE",
      });

      await expect(resumeCampaign("c1", ownerId)).rejects.toThrow(
        ValidationError
      );
    });

    it("throws NotFoundError when campaign does not exist", async () => {
      mockFindFirst.mockResolvedValue(null);
      await expect(resumeCampaign("missing", ownerId)).rejects.toThrow(
        NotFoundError
      );
    });

    it("throws ForbiddenError when requestor is not the owner", async () => {
      mockFindFirst.mockResolvedValue({
        id: "c1",
        advertiserId: "other-user",
        status: "PAUSED",
      });

      await expect(resumeCampaign("c1", ownerId)).rejects.toThrow(
        ForbiddenError
      );
    });

    it("fires campaign.oversubscribed when post-resume coverage is short", async () => {
      mockFindFirst.mockResolvedValue({
        id: "c1",
        advertiserId: ownerId,
        status: "PAUSED",
      });
      mockUpdate.mockResolvedValue({ id: "c1", status: "ACTIVE" });
      // After the resume update, the advertiser has an active campaign with
      // $1000 of headroom but only $100 in the wallet → oversubscribed.
      (prisma.campaign.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "c1", budgetCents: 100_000, escrowAccount: { totalDepositedCents: 0 } },
      ]);
      (prisma.wallet.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        availableCents: 100,
      });

      await resumeCampaign("c1", ownerId);

      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "campaign.oversubscribed",
          data: expect.objectContaining({
            advertiserId: ownerId,
            shortfallCents: 99_900,
          }),
        })
      );
    });

    it("does not fire oversubscribed when wallet covers headroom", async () => {
      mockFindFirst.mockResolvedValue({
        id: "c1",
        advertiserId: ownerId,
        status: "PAUSED",
      });
      mockUpdate.mockResolvedValue({ id: "c1", status: "ACTIVE" });
      (prisma.campaign.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "c1", budgetCents: 100, escrowAccount: { totalDepositedCents: 0 } },
      ]);
      (prisma.wallet.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        availableCents: 10_000,
      });

      await resumeCampaign("c1", ownerId);

      const oversubCalls = (notify as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([arg]) => (arg as { type: string }).type === "campaign.oversubscribed"
      );
      expect(oversubCalls).toHaveLength(0);
    });
  });

  // -- updateCampaign: only DRAFT or PAUSED ------------------------------------

  describe("updateCampaign", () => {
    it("allows update when status is DRAFT", async () => {
      mockFindFirst.mockResolvedValue({
        id: "c1",
        advertiserId: ownerId,
        status: "DRAFT",
      });
      mockUpdate.mockResolvedValue({ id: "c1", name: "New Name" });

      const result = await updateCampaign("c1", ownerId, { name: "New Name" });
      expect(result.name).toBe("New Name");
    });

    it("allows update when status is PAUSED", async () => {
      mockFindFirst.mockResolvedValue({
        id: "c1",
        advertiserId: ownerId,
        status: "PAUSED",
      });
      mockUpdate.mockResolvedValue({ id: "c1", budgetCents: 50000 });

      const result = await updateCampaign("c1", ownerId, {
        budgetCents: 50000,
      });
      expect(result.budgetCents).toBe(50000);
    });

    it("throws ValidationError when status is ACTIVE", async () => {
      mockFindFirst.mockResolvedValue({
        id: "c1",
        advertiserId: ownerId,
        status: "ACTIVE",
      });

      await expect(
        updateCampaign("c1", ownerId, { name: "X" })
      ).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError when status is COMPLETED", async () => {
      mockFindFirst.mockResolvedValue({
        id: "c1",
        advertiserId: ownerId,
        status: "COMPLETED",
      });

      await expect(
        updateCampaign("c1", ownerId, { name: "X" })
      ).rejects.toThrow(ValidationError);
    });

    // -- payout field XOR: guard against invariant corruption -----------------

    it("rejects setting payoutPerUnitCents on a REV_SHARE campaign", async () => {
      mockFindFirst.mockResolvedValue({
        id: "c1",
        advertiserId: ownerId,
        status: "DRAFT",
        compensationModel: "REV_SHARE",
      });

      await expect(
        updateCampaign("c1", ownerId, { payoutPerUnitCents: 500 })
      ).rejects.toThrow(/payoutPerUnitCents.*REV_SHARE/);
    });

    it("rejects setting payoutPercentage on a CPA campaign", async () => {
      mockFindFirst.mockResolvedValue({
        id: "c1",
        advertiserId: ownerId,
        status: "DRAFT",
        compensationModel: "CPA",
      });

      await expect(
        updateCampaign("c1", ownerId, { payoutPercentage: 20 })
      ).rejects.toThrow(/payoutPercentage.*CPA/);
    });

    it("allows updating payoutPercentage on a REV_SHARE campaign", async () => {
      mockFindFirst.mockResolvedValue({
        id: "c1",
        advertiserId: ownerId,
        status: "DRAFT",
        compensationModel: "REV_SHARE",
      });
      mockUpdate.mockResolvedValue({ id: "c1", payoutPercentage: 25 });

      const result = await updateCampaign("c1", ownerId, {
        payoutPercentage: 25,
      });
      expect(result.payoutPercentage).toBe(25);
    });

    it("allows updating payoutPerUnitCents on a CPA campaign", async () => {
      mockFindFirst.mockResolvedValue({
        id: "c1",
        advertiserId: ownerId,
        status: "DRAFT",
        compensationModel: "CPA",
      });
      mockUpdate.mockResolvedValue({ id: "c1", payoutPerUnitCents: 750 });

      const result = await updateCampaign("c1", ownerId, {
        payoutPerUnitCents: 750,
      });
      expect(result.payoutPerUnitCents).toBe(750);
    });
  });

  // -- deleteCampaign: only DRAFT ----------------------------------------------

  describe("deleteCampaign", () => {
    it("allows deletion when status is DRAFT", async () => {
      mockFindFirst.mockResolvedValue({
        id: "c1",
        advertiserId: ownerId,
        status: "DRAFT",
      });
      mockUpdate.mockResolvedValue({ id: "c1", status: "CANCELLED" });

      const result = await deleteCampaign("c1", ownerId);
      expect(result.status).toBe("CANCELLED");
    });

    it("throws ValidationError when status is ACTIVE", async () => {
      mockFindFirst.mockResolvedValue({
        id: "c1",
        advertiserId: ownerId,
        status: "ACTIVE",
      });

      await expect(deleteCampaign("c1", ownerId)).rejects.toThrow(
        ValidationError
      );
    });
  });
});

// ---------------------------------------------------------------------------
// discoverCampaigns
// ---------------------------------------------------------------------------

describe("discoverCampaigns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries only active, non-deleted campaigns for public discovery", async () => {
    (prisma.campaign.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.campaign.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    await discoverCampaigns({
      compensationModel: "CPA",
      category: "saas",
      geo: "US",
      query: "analytics",
      page: 2,
      pageSize: 10,
    });

    const expectedWhere = {
      status: "ACTIVE",
      deletedAt: null,
      compensationModel: "CPA",
      categories: { has: "saas" },
      geoTargets: { has: "US" },
      name: { contains: "analytics", mode: "insensitive" },
    };

    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
        skip: 10,
        take: 10,
        select: expect.objectContaining({
          payoutPerUnitCents: true,
          payoutPercentage: true,
        }),
      })
    );
    expect(prisma.campaign.count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });
});

// ---------------------------------------------------------------------------
// computeAdvertiserBudgetCoverage
// ---------------------------------------------------------------------------

describe("computeAdvertiserBudgetCoverage", () => {
  const advertiserId = "adv-1";
  const mockFindMany = prisma.campaign.findMany as ReturnType<typeof vi.fn>;
  const mockWalletFindUnique = prisma.wallet.findUnique as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports not oversubscribed when wallet covers headroom", async () => {
    mockFindMany.mockResolvedValue([
      { id: "c1", budgetCents: 1000, escrowAccount: { totalDepositedCents: 0 } },
      { id: "c2", budgetCents: 500, escrowAccount: { totalDepositedCents: 100 } },
    ]);
    mockWalletFindUnique.mockResolvedValue({ availableCents: 2000 });

    const result = await computeAdvertiserBudgetCoverage(advertiserId);

    expect(result.activeCampaignCount).toBe(2);
    expect(result.activeBudgetHeadroomCents).toBe(1000 + 400);
    expect(result.walletAvailableCents).toBe(2000);
    expect(result.shortfallCents).toBe(0);
    expect(result.oversubscribed).toBe(false);
  });

  it("flags oversubscribed when combined headroom exceeds wallet", async () => {
    mockFindMany.mockResolvedValue([
      { id: "c1", budgetCents: 10000, escrowAccount: { totalDepositedCents: 1000 } },
      { id: "c2", budgetCents: 5000, escrowAccount: null },
    ]);
    mockWalletFindUnique.mockResolvedValue({ availableCents: 2000 });

    const result = await computeAdvertiserBudgetCoverage(advertiserId);

    expect(result.activeBudgetHeadroomCents).toBe(9000 + 5000);
    expect(result.shortfallCents).toBe(14000 - 2000);
    expect(result.oversubscribed).toBe(true);
  });

  it("treats missing wallet as zero balance", async () => {
    mockFindMany.mockResolvedValue([
      { id: "c1", budgetCents: 100, escrowAccount: { totalDepositedCents: 0 } },
    ]);
    mockWalletFindUnique.mockResolvedValue(null);

    const result = await computeAdvertiserBudgetCoverage(advertiserId);

    expect(result.walletAvailableCents).toBe(0);
    expect(result.shortfallCents).toBe(100);
    expect(result.oversubscribed).toBe(true);
  });

  it("ignores deposited-over-budget campaigns (no negative headroom)", async () => {
    // Some historic campaign may have totalDeposited > budget if the budget
    // was lowered; clamp to zero rather than subtracting.
    mockFindMany.mockResolvedValue([
      { id: "c1", budgetCents: 500, escrowAccount: { totalDepositedCents: 800 } },
    ]);
    mockWalletFindUnique.mockResolvedValue({ availableCents: 100 });

    const result = await computeAdvertiserBudgetCoverage(advertiserId);

    expect(result.activeBudgetHeadroomCents).toBe(0);
    expect(result.oversubscribed).toBe(false);
  });

  it("returns zeros when the advertiser has no active campaigns", async () => {
    mockFindMany.mockResolvedValue([]);
    mockWalletFindUnique.mockResolvedValue({ availableCents: 5000 });

    const result = await computeAdvertiserBudgetCoverage(advertiserId);

    expect(result.activeCampaignCount).toBe(0);
    expect(result.activeBudgetHeadroomCents).toBe(0);
    expect(result.oversubscribed).toBe(false);
  });
});

// Silence the unused-import lint for the mocked notify function; imported so
// that the mock is registered even though individual tests don't assert on it.
void notify;
