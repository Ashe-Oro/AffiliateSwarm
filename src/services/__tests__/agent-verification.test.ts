import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import { resendAgentVerificationEmail } from "../agent.service";

describe("resendAgentVerificationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("repairs missing agent email from the owner account and resends verification", async () => {
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "agent-1",
      email: null,
      displayName: "Advertiser",
      verificationLevel: "UNVERIFIED",
      ownerUser: {
        email: "owner@example.com",
      },
    });

    await resendAgentVerificationEmail("agent-1");

    expect(prisma.agent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "agent-1" },
        data: expect.objectContaining({
          email: "owner@example.com",
          emailVerifyToken: expect.any(String),
          emailVerifyTokenExpiresAt: expect.any(Date),
        }),
      })
    );

    const token = (
      prisma.agent.update as ReturnType<typeof vi.fn>
    ).mock.calls[0][0].data.emailVerifyToken;

    expect(sendVerificationEmail).toHaveBeenCalledWith(
      "owner@example.com",
      token,
      "agent-1"
    );

    // Second update call records the success outcome — verificationEmailSentAt
    // is set, lastError is cleared.
    expect(prisma.agent.update).toHaveBeenCalledTimes(2);
    expect(prisma.agent.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: "agent-1" },
        data: expect.objectContaining({
          verificationEmailSentAt: expect.any(Date),
          verificationEmailLastAttemptAt: expect.any(Date),
          verificationEmailLastError: null,
        }),
      })
    );
  });

  it("records the failure outcome and re-throws when sending fails", async () => {
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "agent-1",
      email: "owner@example.com",
      displayName: "Advertiser",
      verificationLevel: "UNVERIFIED",
      ownerUser: { email: "owner@example.com" },
    });
    (sendVerificationEmail as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Failed to send verification email")
    );

    await expect(resendAgentVerificationEmail("agent-1")).rejects.toThrow(
      "Failed to send verification email"
    );

    // Second update records the failure: lastError populated, sentAt absent
    expect(prisma.agent.update).toHaveBeenCalledTimes(2);
    const lastCall = (prisma.agent.update as ReturnType<typeof vi.fn>).mock
      .calls[1][0];
    expect(lastCall.data.verificationEmailLastError).toBe(
      "Failed to send verification email"
    );
    expect(lastCall.data.verificationEmailLastAttemptAt).toEqual(expect.any(Date));
    expect(lastCall.data.verificationEmailSentAt).toBeUndefined();
  });

  it("rejects resending after the email is already verified", async () => {
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "agent-1",
      email: "owner@example.com",
      displayName: "Advertiser",
      verificationLevel: "EMAIL_VERIFIED",
      ownerUser: {
        email: "owner@example.com",
      },
    });

    await expect(
      resendAgentVerificationEmail("agent-1")
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Email is already verified",
    });
  });
});
