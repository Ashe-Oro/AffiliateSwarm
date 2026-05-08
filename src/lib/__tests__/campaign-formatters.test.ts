import { describe, it, expect } from "vitest";
import { formatHoldingPeriodDays } from "@/lib/campaign-formatters";

describe("formatHoldingPeriodDays", () => {
  it("renders 0 as '0 days (instant)' so advertisers can confirm an instant payout config", () => {
    expect(formatHoldingPeriodDays(0)).toBe("0 days (instant)");
  });

  it("renders 1 singular", () => {
    expect(formatHoldingPeriodDays(1)).toBe("1 day");
  });

  it("renders the default 30 correctly", () => {
    expect(formatHoldingPeriodDays(30)).toBe("30 days");
  });

  it("renders arbitrary day counts", () => {
    expect(formatHoldingPeriodDays(7)).toBe("7 days");
    expect(formatHoldingPeriodDays(90)).toBe("90 days");
  });
});
