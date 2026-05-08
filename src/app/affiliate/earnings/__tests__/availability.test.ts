import { describe, it, expect } from "vitest";
import { getAvailability } from "../availability";

const NOW = new Date("2026-05-01T12:00:00Z");

describe("getAvailability", () => {
  it("returns -- for non-verified leads", () => {
    const result = getAvailability(
      { status: "PENDING_VERIFICATION", escrowHold: null },
      NOW
    );
    expect(result).toEqual({ label: "--", variant: "secondary" });
  });

  it("returns Pending when verified lead has no escrow hold", () => {
    const result = getAvailability(
      { status: "VERIFIED", escrowHold: null },
      NOW
    );
    expect(result).toEqual({ label: "Pending", variant: "secondary" });
  });

  it("shows day count and release date for leads still in holding", () => {
    const releaseAt = new Date("2026-05-17T12:00:00Z");
    const result = getAvailability(
      {
        status: "VERIFIED",
        escrowHold: { status: "PENDING_RELEASE", releaseAt },
      },
      NOW
    );
    expect(result.label).toBe("16 days");
    expect(result.variant).toBe("outline");
    expect(result.dateLine).toBe("May 17");
  });

  it("uses singular 'day' when exactly one day remains", () => {
    const releaseAt = new Date("2026-05-02T12:00:00Z");
    const result = getAvailability(
      {
        status: "VERIFIED",
        escrowHold: { status: "PENDING_RELEASE", releaseAt },
      },
      NOW
    );
    expect(result.label).toBe("1 day");
  });

  it("treats PENDING_RELEASE with past releaseAt as Available using releaseAt", () => {
    const releaseAt = new Date("2026-04-11T12:00:00Z");
    const result = getAvailability(
      {
        status: "VERIFIED",
        escrowHold: { status: "PENDING_RELEASE", releaseAt },
      },
      NOW
    );
    expect(result.label).toBe("Available");
    expect(result.variant).toBe("default");
    expect(result.dateLine).toBe("since Apr 11");
  });

  it("shows 'since <releasedAt>' for RELEASED holds", () => {
    const releasedAt = new Date("2026-04-11T08:00:00Z");
    const releaseAt = new Date("2026-04-10T12:00:00Z");
    const result = getAvailability(
      {
        status: "VERIFIED",
        escrowHold: { status: "RELEASED", releaseAt, releasedAt },
      },
      NOW
    );
    expect(result.label).toBe("Available");
    expect(result.variant).toBe("default");
    expect(result.dateLine).toBe("since Apr 11");
  });

  it("falls back to releaseAt when releasedAt is missing on RELEASED holds", () => {
    const releaseAt = new Date("2026-04-10T12:00:00Z");
    const result = getAvailability(
      {
        status: "VERIFIED",
        escrowHold: { status: "RELEASED", releaseAt, releasedAt: null },
      },
      NOW
    );
    expect(result.dateLine).toBe("since Apr 10");
  });

  it("returns Pending for holds in other states (HELD, REFUNDED)", () => {
    const result = getAvailability(
      {
        status: "VERIFIED",
        escrowHold: { status: "HELD", releaseAt: null },
      },
      NOW
    );
    expect(result).toEqual({ label: "Pending", variant: "secondary" });
  });
});
