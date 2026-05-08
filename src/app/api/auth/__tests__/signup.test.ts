import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userAccount: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    agent: {
      findFirst: vi.fn(),
      create: vi.fn(),
      // recordVerificationEmailOutcome writes to update() after every send;
      // mock as a noop so the post-send tracking write doesn't fail the test.
      update: vi.fn().mockResolvedValue({}),
    },
    wallet: {
      create: vi.fn(),
    },
    agentReputation: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed-password"),
}));

vi.mock("@/lib/auth/session", () => ({
  createSession: vi.fn().mockResolvedValue("session-token"),
  SESSION_COOKIE: "regatta_session",
  SESSION_DURATION_MS: 30 * 24 * 60 * 60 * 1000,
}));

vi.mock("@/services/chain.service", () => ({
  deriveAdvertiserWalletAddress: vi.fn().mockResolvedValue({
    depositAddress: "0x" + "a".repeat(40),
    hdIndex: 1,
  }),
  applyAdvertiserWalletInit: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

import { NextRequest } from "next/server";
import { POST } from "../signup/route";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";

function buildRequest(body: unknown): NextRequest {
  return new NextRequest(new URL("http://localhost:3000/api/auth/signup"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores verification fields and sends the verification email", async () => {
    const fakeUser = {
      id: "user-1",
      email: "advertiser@example.com",
      displayName: "Advertiser",
    };

    const fakeAgent = {
      id: "agent-1",
      type: "ADVERTISER",
    };

    (prisma.userAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<unknown>) => {
        (prisma.userAccount.create as ReturnType<typeof vi.fn>).mockResolvedValue(fakeUser);
        (prisma.agent.create as ReturnType<typeof vi.fn>).mockImplementation(
          async ({ data }: { data: Record<string, unknown> }) => ({
            ...fakeAgent,
            email: data.email,
            emailVerifyToken: data.emailVerifyToken,
            emailVerifyTokenExpiresAt: data.emailVerifyTokenExpiresAt,
          })
        );
        (prisma.wallet.create as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: "wallet-1",
        });
        (prisma.agentReputation.create as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: "rep-1",
        });

        return fn(prisma);
      }
    );

    const res = await POST(
      buildRequest({
        email: "advertiser@example.com",
        password: "password123",
        displayName: "Advertiser",
      })
    );

    expect(res.status).toBe(201);
    expect(prisma.agent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "advertiser@example.com",
          emailVerifyToken: expect.any(String),
          emailVerifyTokenExpiresAt: expect.any(Date),
        }),
      })
    );

    const createdToken = (
      prisma.agent.create as ReturnType<typeof vi.fn>
    ).mock.calls[0][0].data.emailVerifyToken;

    expect(sendVerificationEmail).toHaveBeenCalledWith(
      "advertiser@example.com",
      createdToken,
      "agent-1"
    );

    const json = await res.json();
    expect(json.data.verificationEmailSent).toBe(true);
    expect(json.data.verificationEmailError).toBeUndefined();
  });

  it("returns 201 with verificationEmailSent=false when the verification email fails", async () => {
    (sendVerificationEmail as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Failed to send verification email")
    );

    (prisma.userAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<unknown>) => {
        (prisma.userAccount.create as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: "user-3",
          email: "advertiser@example.com",
          displayName: "Advertiser",
        });
        (prisma.agent.create as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: "agent-3",
          type: "ADVERTISER",
        });
        (prisma.wallet.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "w-3" });
        (prisma.agentReputation.create as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: "r-3",
        });
        return fn(prisma);
      }
    );

    const res = await POST(
      buildRequest({
        email: "advertiser@example.com",
        password: "password123",
        displayName: "Advertiser",
      })
    );

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.user.id).toBe("user-3");
    expect(json.data.verificationEmailSent).toBe(false);
    expect(json.data.verificationEmailError).toBe(
      "Failed to send verification email"
    );
  });

  it("records tosAcceptedAt and tosVersion on the user account", async () => {
    (prisma.userAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<unknown>) => {
        (prisma.userAccount.create as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: "user-2",
          email: "advertiser@example.com",
          displayName: "Advertiser",
        });
        (prisma.agent.create as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: "agent-2",
          type: "ADVERTISER",
        });
        (prisma.wallet.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "w-2" });
        (prisma.agentReputation.create as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: "r-2",
        });
        return fn(prisma);
      }
    );

    await POST(
      buildRequest({
        email: "advertiser@example.com",
        password: "password123",
        displayName: "Advertiser",
      })
    );

    expect(prisma.userAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tosAcceptedAt: expect.any(Date),
          tosVersion: expect.any(String),
        }),
      })
    );
  });

  it("returns 409 when the email is already used by an agent", async () => {
    (prisma.userAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "existing-agent",
    });

    const res = await POST(
      buildRequest({
        email: "advertiser@example.com",
        password: "password123",
        displayName: "Advertiser",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error.message).toBe("Email is already registered");
  });
});
