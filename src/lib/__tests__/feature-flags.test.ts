import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ENABLE_AFFILIATE_REFERRALS_TAB,
  ENABLE_AFFILIATE_REPUTATION_TAB,
  ENABLE_BANK_TRANSFER,
  ENABLE_STRIPE_DEPOSITS,
  ENABLE_STRIPE_WITHDRAWALS,
} from "@/lib/feature-flags";

describe("affiliate dashboard tab flags", () => {
  const originalReputation = process.env.ENABLE_AFFILIATE_REPUTATION_TAB;
  const originalReferrals = process.env.ENABLE_AFFILIATE_REFERRALS_TAB;
  const originalStripeDeposits = process.env.ENABLE_STRIPE_DEPOSITS;
  const originalStripeWithdrawals = process.env.ENABLE_STRIPE_WITHDRAWALS;
  const originalBankTransfer = process.env.ENABLE_BANK_TRANSFER;

  beforeEach(() => {
    delete process.env.ENABLE_AFFILIATE_REPUTATION_TAB;
    delete process.env.ENABLE_AFFILIATE_REFERRALS_TAB;
    delete process.env.ENABLE_STRIPE_DEPOSITS;
    delete process.env.ENABLE_STRIPE_WITHDRAWALS;
    delete process.env.ENABLE_BANK_TRANSFER;
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
    if (originalStripeDeposits === undefined) {
      delete process.env.ENABLE_STRIPE_DEPOSITS;
    } else {
      process.env.ENABLE_STRIPE_DEPOSITS = originalStripeDeposits;
    }
    if (originalStripeWithdrawals === undefined) {
      delete process.env.ENABLE_STRIPE_WITHDRAWALS;
    } else {
      process.env.ENABLE_STRIPE_WITHDRAWALS = originalStripeWithdrawals;
    }
    if (originalBankTransfer === undefined) {
      delete process.env.ENABLE_BANK_TRANSFER;
    } else {
      process.env.ENABLE_BANK_TRANSFER = originalBankTransfer;
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

  describe("payment rail flags", () => {
    it("keeps Stripe deposits and withdrawals disabled by default", () => {
      expect(ENABLE_STRIPE_DEPOSITS()).toBe(false);
      expect(ENABLE_STRIPE_WITHDRAWALS()).toBe(false);
    });

    it("enables Stripe deposits only when explicitly opted in", () => {
      process.env.ENABLE_STRIPE_DEPOSITS = "true";
      expect(ENABLE_STRIPE_DEPOSITS()).toBe(true);

      process.env.ENABLE_STRIPE_DEPOSITS = "0";
      expect(ENABLE_STRIPE_DEPOSITS()).toBe(false);
    });

    it("enables Stripe withdrawals only when explicitly opted in", () => {
      process.env.ENABLE_STRIPE_WITHDRAWALS = "1";
      expect(ENABLE_STRIPE_WITHDRAWALS()).toBe(true);

      process.env.ENABLE_STRIPE_WITHDRAWALS = "false";
      expect(ENABLE_STRIPE_WITHDRAWALS()).toBe(false);
    });

    it("keeps ACH deposits as a separate opt-in flag", () => {
      expect(ENABLE_BANK_TRANSFER()).toBe(false);

      process.env.ENABLE_BANK_TRANSFER = "true";
      expect(ENABLE_BANK_TRANSFER()).toBe(true);
    });
  });
});
