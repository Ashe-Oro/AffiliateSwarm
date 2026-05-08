import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/middleware", () => ({
  getAuthContext: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionFromRequest: vi.fn(),
  validateSession: vi.fn(),
  SESSION_COOKIE: "affiliateswarm_session",
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: {
      findMany: vi.fn(),
    },
  },
}));

import { getAuthContext } from "@/lib/auth/middleware";
import { requireEmailVerified } from "@/lib/auth/rbac";
import { requireAdvertiserAgent } from "@/lib/auth/dashboard";
import { requireAffiliateAgent } from "@/lib/auth/affiliate-dashboard";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const mockGetAuthContext = vi.mocked(getAuthContext);
const mockGetSessionFromRequest = vi.mocked(getSessionFromRequest);
const mockFindMany = vi.mocked(prisma.agent.findMany);

function createRequest(url = "http://localhost:3000/api/test") {
  return new NextRequest(url);
}

describe("verification gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("requireEmailVerified", () => {
    it("returns 403 EMAIL_NOT_VERIFIED for unverified API agents", async () => {
      mockGetAuthContext.mockReturnValue({
        agent: {
          id: "a1",
          type: "ADVERTISER",
          verificationLevel: "UNVERIFIED",
        },
      } as never);

      const handler = requireEmailVerified()(async () => {
        throw new Error("should not reach handler");
      });

      const res = await handler(createRequest());
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("EMAIL_NOT_VERIFIED");
    });

    it("allows verified API agents", async () => {
      mockGetAuthContext.mockReturnValue({
        agent: {
          id: "a1",
          type: "ADVERTISER",
          verificationLevel: "EMAIL_VERIFIED",
        },
      } as never);

      const handler = requireEmailVerified()(
        async () =>
          new Response(JSON.stringify({ ok: true }), { status: 200 }) as never
      );

      const res = await handler(createRequest());
      expect(res.status).toBe(200);
    });
  });

  describe("requireAdvertiserAgent strict mode", () => {
    it("throws EMAIL_NOT_VERIFIED for unverified advertiser dashboard agent", async () => {
      mockGetSessionFromRequest.mockResolvedValue({
        userId: "u1",
        user: { id: "u1", email: "a@b.com" },
      } as never);

      mockFindMany.mockResolvedValue([
        {
          id: "agent-1",
          ownerUserId: "u1",
          type: "ADVERTISER",
          verificationLevel: "UNVERIFIED",
        },
      ] as never);

      await expect(
        requireAdvertiserAgent(createRequest(), { requireEmailVerified: true })
      ).rejects.toMatchObject({ code: "EMAIL_NOT_VERIFIED", statusCode: 403 });
    });

    it("returns advertiser agent when verified", async () => {
      mockGetSessionFromRequest.mockResolvedValue({
        userId: "u1",
        user: { id: "u1", email: "a@b.com" },
      } as never);

      mockFindMany.mockResolvedValue([
        {
          id: "agent-1",
          ownerUserId: "u1",
          type: "ADVERTISER",
          verificationLevel: "EMAIL_VERIFIED",
        },
      ] as never);

      const result = await requireAdvertiserAgent(createRequest(), {
        requireEmailVerified: true,
      });

      expect(result.agent.id).toBe("agent-1");
    });
  });

  describe("requireAffiliateAgent strict mode", () => {
    it("throws EMAIL_NOT_VERIFIED for unverified affiliate dashboard agent", async () => {
      mockGetSessionFromRequest.mockResolvedValue({
        userId: "u1",
        user: { id: "u1", email: "a@b.com" },
      } as never);

      mockFindMany.mockResolvedValue([
        {
          id: "agent-1",
          ownerUserId: "u1",
          type: "AFFILIATE",
          verificationLevel: "UNVERIFIED",
        },
      ] as never);

      await expect(
        requireAffiliateAgent(createRequest(), { requireEmailVerified: true })
      ).rejects.toMatchObject({ code: "EMAIL_NOT_VERIFIED", statusCode: 403 });
    });

    it("returns affiliate agent when email verified", async () => {
      mockGetSessionFromRequest.mockResolvedValue({
        userId: "u1",
        user: { id: "u1", email: "a@b.com" },
      } as never);

      mockFindMany.mockResolvedValue([
        {
          id: "agent-1",
          ownerUserId: "u1",
          type: "AFFILIATE",
          verificationLevel: "EMAIL_VERIFIED",
        },
      ] as never);

      const result = await requireAffiliateAgent(createRequest(), {
        requireEmailVerified: true,
      });

      expect(result.agent.id).toBe("agent-1");
    });

    it("returns DUAL agent when identity verified", async () => {
      mockGetSessionFromRequest.mockResolvedValue({
        userId: "u1",
        user: { id: "u1", email: "a@b.com" },
      } as never);

      mockFindMany.mockResolvedValue([
        {
          id: "agent-1",
          ownerUserId: "u1",
          type: "DUAL",
          verificationLevel: "IDENTITY_VERIFIED",
        },
      ] as never);

      const result = await requireAffiliateAgent(createRequest(), {
        requireEmailVerified: true,
      });

      expect(result.agent.id).toBe("agent-1");
    });
  });
});
