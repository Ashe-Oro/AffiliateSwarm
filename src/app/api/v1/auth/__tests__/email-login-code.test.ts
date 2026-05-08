import { describe, it, expect, vi, beforeEach } from "vitest";

// Pass-through mocks for the middleware wrappers so the route handler runs
// directly. The route reads its auth context via getAuthContext, which we
// mock to return a fixture agent below.
vi.mock("@/lib/auth/middleware", () => ({
  withAuth: (handler: unknown) => handler,
  getAuthContext: vi.fn(),
}));

vi.mock("@/lib/auth/rate-limit", () => ({
  withRateLimit: (handler: unknown) => handler,
}));

vi.mock("@/lib/email", () => ({
  sendLoginCodeEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth/login-code", () => ({
  ensureUserAccount: vi.fn().mockResolvedValue("user-1"),
  createLoginCode: vi.fn().mockResolvedValue("XYZ987"),
  CODE_TTL_MS: 5 * 60 * 1000,
}));

import { NextRequest } from "next/server";
import { POST } from "../email-login-code/route";
import { getAuthContext } from "@/lib/auth/middleware";
import { sendLoginCodeEmail } from "@/lib/email";

function buildRequest() {
  return new NextRequest(
    new URL("http://localhost:3000/api/v1/auth/email-login-code"),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
    }
  );
}

const FAKE_AGENT = {
  id: "agent-1",
  email: "agent@example.com",
  displayName: "TestAgent",
};

describe("POST /api/v1/auth/email-login-code", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getAuthContext as ReturnType<typeof vi.fn>).mockReturnValue({
      agent: FAKE_AGENT,
    });
    (sendLoginCodeEmail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it("sends the login code and returns 200 with masked email + expiry", async () => {
    const res = await POST(buildRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.email).toBe("ag***@example.com");
    expect(body.data.expiresInSeconds).toBe(300);
    expect(sendLoginCodeEmail).toHaveBeenCalledWith(
      "agent@example.com",
      "XYZ987",
      "TestAgent"
    );
  });

  it("returns 400 NO_EMAIL when the agent has no email on file", async () => {
    (getAuthContext as ReturnType<typeof vi.fn>).mockReturnValue({
      agent: { ...FAKE_AGENT, email: null },
    });

    const res = await POST(buildRequest());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("NO_EMAIL");
    expect(sendLoginCodeEmail).not.toHaveBeenCalled();
  });

  it("returns 503 EMAIL_DELIVERY_FAILED when the email send fails", async () => {
    (sendLoginCodeEmail as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Failed to send login code email")
    );

    const res = await POST(buildRequest());
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("EMAIL_DELIVERY_FAILED");
    expect(body.error.message).toMatch(/login code/i);
  });
});
