import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/email", () => ({
  sendLoginCodeEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth/login-code", () => ({
  ensureUserAccount: vi.fn().mockResolvedValue("user-1"),
  createLoginCode: vi.fn().mockResolvedValue("ABC123"),
  checkIpRateLimit: vi.fn().mockReturnValue(true),
}));

import { NextRequest } from "next/server";
import { POST } from "../email-login-code/route";
import { prisma } from "@/lib/prisma";
import { sendLoginCodeEmail } from "@/lib/email";
import { checkIpRateLimit } from "@/lib/auth/login-code";

function buildRequest(body: unknown) {
  return new NextRequest(
    new URL("http://localhost:3000/api/auth/email-login-code"),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

const GENERIC_MESSAGE =
  "If an account with that email exists, a login code has been sent.";

describe("POST /api/auth/email-login-code", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (checkIpRateLimit as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (sendLoginCodeEmail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it("sends a login code and returns the generic success message for a known email", async () => {
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "agent-1",
      email: "user@example.com",
      displayName: "User",
      ownerUserId: "user-1",
    });

    const res = await POST(buildRequest({ email: "user@example.com" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.message).toBe(GENERIC_MESSAGE);
    expect(sendLoginCodeEmail).toHaveBeenCalledWith(
      "user@example.com",
      "ABC123",
      "User"
    );
  });

  it("returns the same generic 200 response for an unknown email and skips the send", async () => {
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await POST(buildRequest({ email: "unknown@example.com" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.message).toBe(GENERIC_MESSAGE);
    expect(sendLoginCodeEmail).not.toHaveBeenCalled();
  });

  it("preserves enumeration protection when the email send fails (still returns 200)", async () => {
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "agent-1",
      email: "user@example.com",
      displayName: "User",
      ownerUserId: "user-1",
    });
    (sendLoginCodeEmail as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Failed to send login code email")
    );

    const res = await POST(buildRequest({ email: "user@example.com" }));
    const body = await res.json();

    // Same shape as the unknown-email case — an attacker can't tell the
    // difference between "no account" and "account exists but Resend errored".
    expect(res.status).toBe(200);
    expect(body.data.message).toBe(GENERIC_MESSAGE);
    expect(sendLoginCodeEmail).toHaveBeenCalledTimes(1);
  });

  it("returns 400 VALIDATION_ERROR for an invalid email", async () => {
    const res = await POST(buildRequest({ email: "not-an-email" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(sendLoginCodeEmail).not.toHaveBeenCalled();
    expect(prisma.agent.findFirst).not.toHaveBeenCalled();
  });

  it("returns 429 RATE_LIMIT_EXCEEDED when the IP is over the limit", async () => {
    (checkIpRateLimit as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const res = await POST(buildRequest({ email: "user@example.com" }));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(prisma.agent.findFirst).not.toHaveBeenCalled();
    expect(sendLoginCodeEmail).not.toHaveBeenCalled();
  });
});
