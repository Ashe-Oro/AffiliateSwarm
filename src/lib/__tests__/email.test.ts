import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  resendSend: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: vi.fn(function MockResend() {
    return {
    emails: { send: mocks.resendSend },
    };
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { getFromAddress, sendOnboardingEmail, sendWithRetry, RETRY_DELAYS_MS } from "@/lib/email";
import { FROM_EMAIL } from "@/lib/brand";
import { logger } from "@/lib/logger";

const CONTEXT = { operation: "test send", to: "test@example.com" };

describe("sendWithRetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns data on first-try success without retrying", async () => {
    const fn = vi.fn().mockResolvedValue({ data: { id: "ok" }, error: null });

    const result = await sendWithRetry(fn, CONTEXT);

    expect(result).toEqual({ id: "ok" });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("retries on transient error (statusCode: null) then succeeds", async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { statusCode: null, message: "Unable to fetch data" },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { statusCode: null, message: "Unable to fetch data" },
      })
      .mockResolvedValueOnce({ data: { id: "ok" }, error: null });

    const promise = sendWithRetry(fn, CONTEXT);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ id: "ok" });
    expect(fn).toHaveBeenCalledTimes(3);
    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("retries on 5xx then succeeds", async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { statusCode: 503, message: "Service Unavailable" },
      })
      .mockResolvedValueOnce({ data: { id: "ok" }, error: null });

    const promise = sendWithRetry(fn, CONTEXT);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ id: "ok" });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting all retries on persistent transient error", async () => {
    const fn = vi.fn().mockResolvedValue({
      data: null,
      error: { statusCode: null, message: "Unable to fetch data" },
    });

    const promise = sendWithRetry(fn, CONTEXT);
    // Capture the rejection to silence unhandled-rejection warnings
    promise.catch(() => {});
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow("Failed to test send");
    // 1 initial attempt + RETRY_DELAYS_MS.length retries
    expect(fn).toHaveBeenCalledTimes(RETRY_DELAYS_MS.length + 1);
    expect(logger.warn).toHaveBeenCalledTimes(RETRY_DELAYS_MS.length);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry on 4xx errors", async () => {
    const fn = vi.fn().mockResolvedValue({
      data: null,
      error: { statusCode: 422, message: "Validation error" },
    });

    await expect(sendWithRetry(fn, CONTEXT)).rejects.toThrow(
      "Failed to test send"
    );
    expect(fn).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry on 401 (unauthorized — bad API key)", async () => {
    const fn = vi.fn().mockResolvedValue({
      data: null,
      error: { statusCode: 401, message: "Unauthorized" },
    });

    await expect(sendWithRetry(fn, CONTEXT)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("uses configured delays between attempts", async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { statusCode: null, message: "transient" },
      })
      .mockResolvedValueOnce({ data: { id: "ok" }, error: null });

    const promise = sendWithRetry(fn, CONTEXT);
    promise.catch(() => {});

    // First attempt has fired synchronously; second is gated on the first
    // configured delay. Confirm we haven't called fn again until time passes.
    await Promise.resolve();
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);
    await promise;
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("sendOnboardingEmail", () => {
  const originalResendApiKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "re_test";
    mocks.resendSend.mockResolvedValue({ data: { id: "email-1" }, error: null });
  });

  afterEach(() => {
    if (originalResendApiKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = originalResendApiKey;
    }
  });

  it("tells advertisers to fund campaigns with USDC on the Base blockchain", async () => {
    await sendOnboardingEmail(
      "advertiser@example.com",
      "Advertiser",
      "ADVERTISER",
      "agent-1"
    );

    expect(mocks.resendSend).toHaveBeenCalledTimes(1);
    const payload = mocks.resendSend.mock.calls[0]?.[0];
    expect(payload.html).toContain(
      "Fund your campaign with USDC on the Base blockchain"
    );
    expect(payload.html).not.toContain("card, ACH, or USDC");
  });

  it("keeps affiliate onboarding email off card and ACH rails", async () => {
    await sendOnboardingEmail(
      "affiliate@example.com",
      "Affiliate",
      "AFFILIATE",
      "agent-2"
    );

    expect(mocks.resendSend).toHaveBeenCalledTimes(1);
    const payload = mocks.resendSend.mock.calls[0]?.[0];
    expect(payload.html).not.toMatch(/card|ACH/i);
    expect(payload.html).toContain(
      "Start earning commissions on every conversion"
    );
  });
});

describe("getFromAddress", () => {
  const original = process.env.EMAIL_FROM;

  afterEach(() => {
    if (original === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = original;
  });

  it("uses the placeholder until EMAIL_FROM is set", () => {
    delete process.env.EMAIL_FROM;
    expect(getFromAddress()).toBe(FROM_EMAIL);
    expect(FROM_EMAIL).toContain("noreply@your-deployment.example");
  });

  it("reads EMAIL_FROM at send time", () => {
    process.env.EMAIL_FROM = "  AffiliateSwarm <noreply@operator.example>  ";
    expect(getFromAddress()).toBe("AffiliateSwarm <noreply@operator.example>");
  });
});
