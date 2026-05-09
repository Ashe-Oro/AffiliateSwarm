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
  resendAgentVerificationEmail: vi.fn(),
}));

import { NextRequest } from "next/server";
import { PATCH, POST } from "../route";
import { prisma } from "@/lib/prisma";
import { resendAgentVerificationEmail } from "@/services/agent.service";

const ADMIN_SECRET = "test-admin-secret";

function buildRequest(
  method: string,
  body?: unknown,
  withAdminAuth: boolean = true
): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (withAdminAuth) {
    headers.cookie = `affiliateswarm_admin_token=${ADMIN_SECRET}`;
  }

  return new NextRequest(new URL("http://localhost:3000/api/admin/agents"), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("/api/admin/agents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_SECRET = ADMIN_SECRET;
  });

  it("resends verification email for an admin request", async () => {
    (resendAgentVerificationEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
      email: "owner@example.com",
      expiresAt: new Date("2026-04-09T12:00:00.000Z"),
    });

    const res = await POST(buildRequest("POST", { agentId: "agent-1" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.email).toBe("owner@example.com");
    expect(resendAgentVerificationEmail).toHaveBeenCalledWith("agent-1");
  });

  it("suspends an agent for an admin request", async () => {
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "agent-1",
      status: "ACTIVE",
    });
    (prisma.agent.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "agent-1",
      status: "SUSPENDED",
    });

    const res = await PATCH(
      buildRequest("PATCH", { agentId: "agent-1", action: "SUSPEND" })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.agent.status).toBe("SUSPENDED");
  });

  it("rejects unauthorized admin requests", async () => {
    const res = await POST(buildRequest("POST", { agentId: "agent-1" }, false));

    expect(res.status).toBe(401);
  });
});
