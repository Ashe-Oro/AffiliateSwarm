import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Prisma — we verify the service calls the right queries with the right
// filters, without needing a real database.
// ---------------------------------------------------------------------------

const mockCount = vi.fn().mockResolvedValue(0);
const mockAggregate = vi.fn().mockResolvedValue({ _sum: { amountCents: 0 } });

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { count: (...args: unknown[]) => mockCount("agent", ...args) },
    campaign: { count: (...args: unknown[]) => mockCount("campaign", ...args) },
    affiliateEnrollment: {
      count: (...args: unknown[]) => mockCount("enrollment", ...args),
    },
    conversionEvent: {
      count: (...args: unknown[]) => mockCount("conversion", ...args),
    },
    lead: { count: (...args: unknown[]) => mockCount("lead", ...args) },
  },
}));

import { getAdminV1Stats } from "@/services/admin-stats.service";
import type { AdminV1Stats } from "@/services/admin-stats.service";

describe("getAdminV1Stats", () => {
  beforeEach(() => {
    mockCount.mockReset().mockResolvedValue(0);
  });

  it("returns all 10 V1 KPI fields", async () => {
    const stats = await getAdminV1Stats();

    const expectedKeys: (keyof AdminV1Stats)[] = [
      "advertisersRegistered",
      "advertisersVerified",
      "affiliatesRegistered",
      "affiliatesVerified",
      "campaignsOngoing",
      "affiliatesApplied",
      "affiliatesAccepted",
      "affiliatesRejected",
      "totalConversions",
      "totalLeads",
    ];

    for (const key of expectedKeys) {
      expect(stats).toHaveProperty(key);
      expect(typeof stats[key]).toBe("number");
    }
  });

  it("issues exactly 10 parallel count queries", async () => {
    await getAdminV1Stats();
    expect(mockCount).toHaveBeenCalledTimes(10);
  });

  it("queries advertisers with ADVERTISER and DUAL types", async () => {
    await getAdminV1Stats();

    // First call: advertisersRegistered
    const [model, where] = mockCount.mock.calls[0];
    expect(model).toBe("agent");
    expect(where).toEqual({
      where: {
        deletedAt: null,
        type: { in: ["ADVERTISER", "DUAL"] },
      },
    });
  });

  it("queries verified advertisers with correct verification levels", async () => {
    await getAdminV1Stats();

    // Second call: advertisersVerified
    const [model, where] = mockCount.mock.calls[1];
    expect(model).toBe("agent");
    expect(where.where.verificationLevel).toEqual({
      in: ["EMAIL_VERIFIED", "IDENTITY_VERIFIED"],
    });
    expect(where.where.type).toEqual({ in: ["ADVERTISER", "DUAL"] });
  });

  it("queries affiliates with AFFILIATE and DUAL types", async () => {
    await getAdminV1Stats();

    // Third call: affiliatesRegistered
    const [model, where] = mockCount.mock.calls[2];
    expect(model).toBe("agent");
    expect(where).toEqual({
      where: {
        deletedAt: null,
        type: { in: ["AFFILIATE", "DUAL"] },
      },
    });
  });

  it("queries ongoing campaigns with ACTIVE status only", async () => {
    await getAdminV1Stats();

    // Fifth call: campaignsOngoing
    const [model, where] = mockCount.mock.calls[4];
    expect(model).toBe("campaign");
    expect(where).toEqual({
      where: { deletedAt: null, status: "ACTIVE" },
    });
  });

  it("queries enrollments for applied/accepted/rejected", async () => {
    await getAdminV1Stats();

    // Calls 5, 6, 7: enrollment counts
    const [applyModel] = mockCount.mock.calls[5];
    const [acceptModel, acceptWhere] = mockCount.mock.calls[6];
    const [rejectModel, rejectWhere] = mockCount.mock.calls[7];

    expect(applyModel).toBe("enrollment");
    expect(acceptModel).toBe("enrollment");
    expect(acceptWhere).toEqual({ where: { status: "APPROVED" } });
    expect(rejectModel).toBe("enrollment");
    expect(rejectWhere).toEqual({ where: { status: "REJECTED" } });
  });

  it("returns correct values when counts are non-zero", async () => {
    mockCount.mockImplementation((model: string, where?: unknown) => {
      if (model === "agent") return Promise.resolve(42);
      if (model === "campaign") return Promise.resolve(5);
      if (model === "enrollment") return Promise.resolve(20);
      if (model === "conversion") return Promise.resolve(100);
      if (model === "lead") return Promise.resolve(500);
      return Promise.resolve(0);
    });

    const stats = await getAdminV1Stats();

    expect(stats.advertisersRegistered).toBe(42);
    expect(stats.campaignsOngoing).toBe(5);
    expect(stats.affiliatesApplied).toBe(20);
    expect(stats.totalConversions).toBe(100);
    expect(stats.totalLeads).toBe(500);
  });
});
