import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ENABLE_AFFILIATE_REFERRALS_TAB,
  ENABLE_AFFILIATE_REPUTATION_TAB,
} from "@/lib/feature-flags";

describe("affiliate dashboard tab flags", () => {
  const originalReputation = process.env.ENABLE_AFFILIATE_REPUTATION_TAB;
  const originalReferrals = process.env.ENABLE_AFFILIATE_REFERRALS_TAB;

  beforeEach(() => {
    delete process.env.ENABLE_AFFILIATE_REPUTATION_TAB;
    delete process.env.ENABLE_AFFILIATE_REFERRALS_TAB;
  });

  afterEach(() => {
    if (originalReputation === undefined) {
      delete process.env.ENABLE_AFFILIATE_REPUTATION_TAB;
    } else {
      process.env.ENABLE_AFFILIATE_REPUTATION_TAB = originalReputation;
    }
    if (originalReferrals === undefined) {
      delete process.env.ENABLE_AFFILIATE_REFERRALS_TAB;
    } else {
      process.env.ENABLE_AFFILIATE_REFERRALS_TAB = originalReferrals;
    }
  });

  describe("ENABLE_AFFILIATE_REPUTATION_TAB", () => {
    it("is disabled by default when the env var is unset", () => {
      expect(ENABLE_AFFILIATE_REPUTATION_TAB()).toBe(false);
    });

    it.each(["0", "false", "", "no", "off"])(
      "is disabled when env var is %s",
      (val) => {
        process.env.ENABLE_AFFILIATE_REPUTATION_TAB = val;
        expect(ENABLE_AFFILIATE_REPUTATION_TAB()).toBe(false);
      }
    );

    it.each(["1", "true"])("is enabled when env var is %s", (val) => {
      process.env.ENABLE_AFFILIATE_REPUTATION_TAB = val;
      expect(ENABLE_AFFILIATE_REPUTATION_TAB()).toBe(true);
    });
  });

  describe("ENABLE_AFFILIATE_REFERRALS_TAB", () => {
    it("is disabled by default when the env var is unset", () => {
      expect(ENABLE_AFFILIATE_REFERRALS_TAB()).toBe(false);
    });

    it.each(["0", "false", "", "no", "off"])(
      "is disabled when env var is %s",
      (val) => {
        process.env.ENABLE_AFFILIATE_REFERRALS_TAB = val;
        expect(ENABLE_AFFILIATE_REFERRALS_TAB()).toBe(false);
      }
    );

    it.each(["1", "true"])("is enabled when env var is %s", (val) => {
      process.env.ENABLE_AFFILIATE_REFERRALS_TAB = val;
      expect(ENABLE_AFFILIATE_REFERRALS_TAB()).toBe(true);
    });
  });

  it("the two flags are independent", () => {
    process.env.ENABLE_AFFILIATE_REPUTATION_TAB = "1";
    expect(ENABLE_AFFILIATE_REPUTATION_TAB()).toBe(true);
    expect(ENABLE_AFFILIATE_REFERRALS_TAB()).toBe(false);

    delete process.env.ENABLE_AFFILIATE_REPUTATION_TAB;
    process.env.ENABLE_AFFILIATE_REFERRALS_TAB = "1";
    expect(ENABLE_AFFILIATE_REPUTATION_TAB()).toBe(false);
    expect(ENABLE_AFFILIATE_REFERRALS_TAB()).toBe(true);
  });
});
