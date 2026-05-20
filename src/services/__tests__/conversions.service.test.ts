import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  deriveUnifiedStatus,
  deriveAffiliateStatus,
  affiliateStatusFilterToWhere,
  listAdvertiserConversions,
} from "@/services/conversions.service";

const prismaMock = prisma as unknown as {
  lead: {
    findMany: Mock;
    count: Mock;
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("deriveUnifiedStatus", () => {
  const past = new Date("2026-01-01T00:00:00Z");
  const future = new Date("2099-01-01T00:00:00Z");
  const now = new Date("2026-04-20T00:00:00Z");

  it("returns DISPUTED when lead is DISPUTED, regardless of hold state", () => {
    expect(deriveUnifiedStatus("DISPUTED", "REFUNDED", null, now)).toBe(
      "DISPUTED"
    );
    expect(deriveUnifiedStatus("DISPUTED", null, null, now)).toBe("DISPUTED");
  });

  it("returns REVERSED for REJECTED or EXPIRED leads", () => {
    expect(deriveUnifiedStatus("REJECTED", null, null, now)).toBe("REVERSED");
    expect(deriveUnifiedStatus("EXPIRED", null, null, now)).toBe("REVERSED");
  });

  it("returns REVERSED when lead is VERIFIED but hold was refunded", () => {
    expect(deriveUnifiedStatus("VERIFIED", "REFUNDED", null, now)).toBe(
      "REVERSED"
    );
  });

  it("returns PAID when lead is VERIFIED and hold is RELEASED", () => {
    expect(deriveUnifiedStatus("VERIFIED", "RELEASED", past, now)).toBe("PAID");
  });

  it("returns HELD when VERIFIED + PENDING_RELEASE with future releaseAt", () => {
    expect(deriveUnifiedStatus("VERIFIED", "PENDING_RELEASE", future, now)).toBe(
      "HELD"
    );
  });

  it("returns MATURED when VERIFIED + PENDING_RELEASE and releaseAt has elapsed", () => {
    expect(deriveUnifiedStatus("VERIFIED", "PENDING_RELEASE", past, now)).toBe(
      "MATURED"
    );
  });

  it("returns HELD for VERIFIED + HELD (pre-release, no releaseAt yet)", () => {
    expect(deriveUnifiedStatus("VERIFIED", "HELD", null, now)).toBe("HELD");
  });

  it("returns PENDING for SUBMITTED/PENDING_VERIFICATION", () => {
    expect(deriveUnifiedStatus("SUBMITTED", null, null, now)).toBe("PENDING");
    expect(
      deriveUnifiedStatus("PENDING_VERIFICATION", null, null, now)
    ).toBe("PENDING");
  });
});

describe("deriveAffiliateStatus (issue #227)", () => {
  const past = new Date("2026-01-01T00:00:00Z");
  const future = new Date("2099-01-01T00:00:00Z");
  const now = new Date("2026-04-20T00:00:00Z");

  it("returns PENDING while the hold window is still active, even if lead is VERIFIED", () => {
    // The core bug from #227: a VERIFIED lead whose hold hasn't matured
    // must NOT show as Verified to the affiliate.
    expect(
      deriveAffiliateStatus("VERIFIED", "PENDING_RELEASE", future, now)
    ).toBe("PENDING");
  });

  it("returns VERIFIED once the hold window has elapsed (clock-authoritative)", () => {
    // Even if the cron hasn't run yet, an elapsed releaseAt means the
    // dispute window is closed — affiliate sees Verified.
    expect(
      deriveAffiliateStatus("VERIFIED", "PENDING_RELEASE", past, now)
    ).toBe("VERIFIED");
  });

  it("returns VERIFIED when the hold has been released", () => {
    expect(deriveAffiliateStatus("VERIFIED", "RELEASED", past, now)).toBe(
      "VERIFIED"
    );
  });

  it("returns REVERSED for DISPUTED leads", () => {
    expect(deriveAffiliateStatus("DISPUTED", "REFUNDED", null, now)).toBe(
      "REVERSED"
    );
  });

  it("returns REVERSED for VERIFIED + REFUNDED (post-verification refund)", () => {
    expect(deriveAffiliateStatus("VERIFIED", "REFUNDED", null, now)).toBe(
      "REVERSED"
    );
  });

  it("returns REVERSED for EXPIRED leads", () => {
    expect(deriveAffiliateStatus("EXPIRED", null, null, now)).toBe("REVERSED");
  });

  it("returns REJECTED for REJECTED leads", () => {
    expect(deriveAffiliateStatus("REJECTED", null, null, now)).toBe("REJECTED");
  });

  it("returns PENDING for SUBMITTED / PENDING_VERIFICATION / HELD / no hold yet", () => {
    expect(deriveAffiliateStatus("SUBMITTED", null, null, now)).toBe("PENDING");
    expect(
      deriveAffiliateStatus("PENDING_VERIFICATION", null, null, now)
    ).toBe("PENDING");
    expect(deriveAffiliateStatus("VERIFIED", "HELD", null, now)).toBe(
      "PENDING"
    );
    expect(deriveAffiliateStatus("VERIFIED", null, null, now)).toBe("PENDING");
  });
});

describe("affiliateStatusFilterToWhere", () => {
  const now = new Date("2026-04-20T00:00:00Z");

  it("PENDING filter matches unverified OR verified-but-in-hold", () => {
    const where = affiliateStatusFilterToWhere("PENDING", now);
    expect(where).toEqual({
      OR: [
        { status: { in: ["SUBMITTED", "PENDING_VERIFICATION"] } },
        {
          status: "VERIFIED",
          OR: [
            { escrowHold: null },
            { escrowHold: { is: { status: "HELD" } } },
            {
              escrowHold: {
                is: {
                  status: "PENDING_RELEASE",
                  releaseAt: { gt: now },
                },
              },
            },
          ],
        },
      ],
    });
  });

  it("VERIFIED filter excludes rows still in the hold window", () => {
    const where = affiliateStatusFilterToWhere("VERIFIED", now);
    expect(where).toEqual({
      status: "VERIFIED",
      escrowHold: {
        is: {
          OR: [
            { status: "RELEASED" },
            { status: "PENDING_RELEASE", releaseAt: { lte: now } },
          ],
        },
      },
    });
  });

  it("REJECTED filter maps to Lead.status = REJECTED", () => {
    expect(affiliateStatusFilterToWhere("REJECTED", now)).toEqual({
      status: "REJECTED",
    });
  });

  it("REVERSED filter matches DISPUTED / EXPIRED / VERIFIED+REFUNDED", () => {
    const where = affiliateStatusFilterToWhere("REVERSED", now);
    expect(where).toEqual({
      OR: [
        { status: "DISPUTED" },
        { status: "EXPIRED" },
        {
          status: "VERIFIED",
          escrowHold: { is: { status: "REFUNDED" } },
        },
      ],
    });
  });
});

describe("listAdvertiserConversions", () => {
  it("returns aggregate status counts instead of counts from the current page", async () => {
    const now = new Date("2026-04-20T00:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    prismaMock.lead.findMany.mockResolvedValue([
      {
        id: "lead-paid-1",
        externalId: "external-paid-1",
        submittedAt: new Date("2026-04-19T00:00:00Z"),
        payoutCents: 1000,
        status: "VERIFIED",
        affiliate: { displayName: "Affiliate One" },
        campaign: { id: "campaign-1", name: "CPA Campaign" },
        escrowHold: {
          status: "RELEASED",
          releaseAt: new Date("2026-04-19T00:00:00Z"),
          amountCents: 1000,
        },
      },
    ]);
    prismaMock.lead.count
      .mockResolvedValueOnce(42) // totalCount
      .mockResolvedValueOnce(2) // PENDING
      .mockResolvedValueOnce(30) // HELD
      .mockResolvedValueOnce(4) // MATURED
      .mockResolvedValueOnce(6) // PAID
      .mockResolvedValueOnce(0) // DISPUTED
      .mockResolvedValueOnce(0); // REVERSED

    const result = await listAdvertiserConversions({
      advertiserId: "advertiser-1",
      campaignId: "campaign-1",
      page: 2,
      pageSize: 1,
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].unifiedStatus).toBe("PAID");
    expect(result.totalCount).toBe(42);
    expect(result.statusCounts).toEqual({
      PENDING: 2,
      HELD: 30,
      MATURED: 4,
      PAID: 6,
      DISPUTED: 0,
      REVERSED: 0,
    });
    expect(prismaMock.lead.count).toHaveBeenCalledTimes(7);
    expect(prismaMock.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 1,
        take: 1,
      })
    );
  });
});
