import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/services/agent.service", () => ({
  sendOnboardingEmailWithTracking: vi.fn().mockResolvedValue(undefined),
}));

import { NextRequest } from "next/server";
import { GET } from "../route";
import { prisma } from "@/lib/prisma";
import { sendOnboardingEmailWithTracking } from "@/services/agent.service";

const VALID_TOKEN = "a".repeat(64);

function buildRequest(agentId: string, token?: string | null) {
  const url = token
    ? `http://localhost:3000/api/v1/agents/${agentId}/verify-email?token=${token}`
    : `http://localhost:3000/api/v1/agents/${agentId}/verify-email`;
  return new NextRequest(new URL(url));
}

const ROUTE_PARAMS = (agentId: string) => ({
  params: Promise.resolve({ agentId }),
});

describe("GET /api/v1/agents/[agentId]/verify-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifies the agent and fires the onboarding email when the token is valid", async () => {
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "agent-1",
      verificationLevel: "UNVERIFIED",
      email: "advertiser@example.com",
      displayName: "Advertiser",
      type: "ADVERTISER",
      emailVerifyToken: VALID_TOKEN,
      emailVerifyTokenExpiresAt: new Date(Date.now() + 60_000),
    });
    (prisma.agent.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const res = await GET(
      buildRequest("agent-1", VALID_TOKEN),
      ROUTE_PARAMS("agent-1")
    );

    expect(res.status).toBe(200);
    expect(prisma.agent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "agent-1" },
        data: expect.objectContaining({
          verificationLevel: "EMAIL_VERIFIED",
          emailVerifyToken: null,
          emailVerifyTokenExpiresAt: null,
        }),
      })
    );
    // Onboarding email is fired (void) — handler doesn't await, but the mock
    // is still recorded synchronously.
    expect(sendOnboardingEmailWithTracking).toHaveBeenCalledWith("agent-1");
  });

  it("returns 200 'already verified' page without firing onboarding when level is not UNVERIFIED", async () => {
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "agent-1",
      verificationLevel: "EMAIL_VERIFIED",
      email: "advertiser@example.com",
      displayName: "Advertiser",
      type: "ADVERTISER",
      emailVerifyToken: null,
      emailVerifyTokenExpiresAt: null,
    });

    const res = await GET(
      buildRequest("agent-1", VALID_TOKEN),
      ROUTE_PARAMS("agent-1")
    );

    expect(res.status).toBe(200);
    expect(prisma.agent.update).not.toHaveBeenCalled();
    expect(sendOnboardingEmailWithTracking).not.toHaveBeenCalled();
  });

  it("returns 400 when the token is missing", async () => {
    const res = await GET(buildRequest("agent-1", null), ROUTE_PARAMS("agent-1"));

    expect(res.status).toBe(400);
    expect(prisma.agent.findFirst).not.toHaveBeenCalled();
    expect(sendOnboardingEmailWithTracking).not.toHaveBeenCalled();
  });

  it("returns 404 when the agent does not exist", async () => {
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await GET(
      buildRequest("missing", VALID_TOKEN),
      ROUTE_PARAMS("missing")
    );

    expect(res.status).toBe(404);
    expect(sendOnboardingEmailWithTracking).not.toHaveBeenCalled();
  });

  it("returns 400 when the token does not match", async () => {
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "agent-1",
      verificationLevel: "UNVERIFIED",
      email: "advertiser@example.com",
      displayName: "Advertiser",
      type: "ADVERTISER",
      emailVerifyToken: VALID_TOKEN,
      emailVerifyTokenExpiresAt: new Date(Date.now() + 60_000),
    });

    const res = await GET(
      buildRequest("agent-1", "wrong-token"),
      ROUTE_PARAMS("agent-1")
    );

    expect(res.status).toBe(400);
    expect(prisma.agent.update).not.toHaveBeenCalled();
    expect(sendOnboardingEmailWithTracking).not.toHaveBeenCalled();
  });

  it("returns 400 when the token has expired", async () => {
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "agent-1",
      verificationLevel: "UNVERIFIED",
      email: "advertiser@example.com",
      displayName: "Advertiser",
      type: "ADVERTISER",
      emailVerifyToken: VALID_TOKEN,
      emailVerifyTokenExpiresAt: new Date(Date.now() - 60_000),
    });

    const res = await GET(
      buildRequest("agent-1", VALID_TOKEN),
      ROUTE_PARAMS("agent-1")
    );

    expect(res.status).toBe(400);
    expect(prisma.agent.update).not.toHaveBeenCalled();
  });
});
