import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAgent = {
  id: "agent-1",
  type: "ADVERTISER",
  status: "ACTIVE",
  verificationLevel: "UNVERIFIED",
  displayName: "TestBot",
  email: "test@example.com",
};

const mockCredential = { id: "cred-1", agentId: "agent-1" };

vi.mock("@/lib/auth", () => ({
  withAuth: (handler: Function) => handler,
  getAuthContext: () => ({ agent: mockAgent, credential: mockCredential }),
}));

vi.mock("@/services/agent.service", () => ({
  resendAgentVerificationEmail: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (loaded after mock registration)
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { POST } from "../route";
import { resendAgentVerificationEmail } from "@/services/agent.service";
import { ConflictError } from "@/lib/errors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRequest(agentId: string): NextRequest {
  return new NextRequest(
    new URL(`http://localhost:3000/api/v1/agents/${agentId}/resend-verification`),
    { method: "POST" }
  );
}

function buildContext(agentId: string) {
  return { params: Promise.resolve({ agentId }) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/v1/agents/:agentId/resend-verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgent.id = "agent-1";
  });

  it("returns 200 and resends verification email for own agent", async () => {
    (resendAgentVerificationEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
      email: "test@example.com",
      expiresAt: new Date("2026-04-10T12:00:00.000Z"),
    });

    const res = await POST(buildRequest("agent-1"), buildContext("agent-1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.ok).toBe(true);
    expect(json.data.email).toBe("test@example.com");
    expect(resendAgentVerificationEmail).toHaveBeenCalledWith("agent-1");
  });

  it("returns 403 when trying to resend for a different agent", async () => {
    const res = await POST(buildRequest("agent-2"), buildContext("agent-2"));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("FORBIDDEN");
    expect(resendAgentVerificationEmail).not.toHaveBeenCalled();
  });

  it("returns 409 when agent is already verified", async () => {
    (resendAgentVerificationEmail as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ConflictError("Email is already verified")
    );

    const res = await POST(buildRequest("agent-1"), buildContext("agent-1"));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("CONFLICT");
  });
});
