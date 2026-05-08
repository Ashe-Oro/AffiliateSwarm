import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/services/agent.service", () => ({
  sweepStaleVerificationEmails: vi.fn(),
  sweepStaleOnboardingEmails: vi.fn(),
}));

vi.mock("@/lib/feature-flags", () => ({
  ENABLE_EMAIL_RETRY_SWEEP: vi.fn(),
}));

import { NextRequest } from "next/server";
import { GET } from "../route";
import {
  sweepStaleVerificationEmails,
  sweepStaleOnboardingEmails,
} from "@/services/agent.service";
import { ENABLE_EMAIL_RETRY_SWEEP } from "@/lib/feature-flags";

const CRON_SECRET = "test-cron-secret";

function buildRequest(authHeader?: string) {
  const headers: Record<string, string> = {};
  if (authHeader) headers.authorization = authHeader;
  return new NextRequest(
    new URL("http://localhost:3000/api/cron/email-retry-sweep"),
    { headers }
  );
}

describe("GET /api/cron/email-retry-sweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
    (ENABLE_EMAIL_RETRY_SWEEP as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (sweepStaleVerificationEmails as ReturnType<typeof vi.fn>).mockResolvedValue({
      found: 0,
      retried: 0,
      succeeded: 0,
      failed: 0,
    });
    (sweepStaleOnboardingEmails as ReturnType<typeof vi.fn>).mockResolvedValue({
      found: 0,
      retried: 0,
      succeeded: 0,
      failed: 0,
    });
  });

  it("returns 401 when the Authorization header is missing", async () => {
    const res = await GET(buildRequest());

    expect(res.status).toBe(401);
    expect(sweepStaleVerificationEmails).not.toHaveBeenCalled();
    expect(sweepStaleOnboardingEmails).not.toHaveBeenCalled();
  });

  it("returns 401 when the bearer token does not match CRON_SECRET", async () => {
    const res = await GET(buildRequest("Bearer wrong-secret"));

    expect(res.status).toBe(401);
    expect(sweepStaleVerificationEmails).not.toHaveBeenCalled();
  });

  it("returns 200 with skipped marker and runs nothing when the flag is off", async () => {
    (ENABLE_EMAIL_RETRY_SWEEP as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const res = await GET(buildRequest(`Bearer ${CRON_SECRET}`));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, skipped: "feature flag disabled" });
    expect(sweepStaleVerificationEmails).not.toHaveBeenCalled();
    expect(sweepStaleOnboardingEmails).not.toHaveBeenCalled();
  });

  it("returns 200 with both sweep results on the happy path", async () => {
    (sweepStaleVerificationEmails as ReturnType<typeof vi.fn>).mockResolvedValue({
      found: 3,
      retried: 3,
      succeeded: 2,
      failed: 1,
    });
    (sweepStaleOnboardingEmails as ReturnType<typeof vi.fn>).mockResolvedValue({
      found: 5,
      retried: 5,
      succeeded: 5,
      failed: 0,
    });

    const res = await GET(buildRequest(`Bearer ${CRON_SECRET}`));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      verification: { found: 3, retried: 3, succeeded: 2, failed: 1 },
      onboarding: { found: 5, retried: 5, succeeded: 5, failed: 0 },
    });
    expect(sweepStaleVerificationEmails).toHaveBeenCalledTimes(1);
    expect(sweepStaleOnboardingEmails).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when a sweep service throws", async () => {
    (sweepStaleVerificationEmails as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("DB unavailable")
    );

    const res = await GET(buildRequest(`Bearer ${CRON_SECRET}`));

    expect(res.status).toBe(500);
  });

  it("returns 401 when CRON_SECRET is unset (defense against missing env)", async () => {
    delete process.env.CRON_SECRET;

    const res = await GET(buildRequest(`Bearer ${CRON_SECRET}`));

    expect(res.status).toBe(401);
  });
});
