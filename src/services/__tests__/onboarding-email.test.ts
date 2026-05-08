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
  sendOnboardingEmail: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/prisma";
import { sendOnboardingEmail } from "@/lib/email";
import {
  sendOnboardingEmailWithTracking,
  resendOnboardingEmail,
} from "../agent.service";

const VERIFIED_AGENT = {
  id: "agent-1",
  email: "advertiser@example.com",
  displayName: "Advertiser",
  type: "ADVERTISER" as const,
  verificationLevel: "EMAIL_VERIFIED" as const,
};

describe("sendOnboardingEmailWithTracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records a success outcome when the email sends", async () => {
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      VERIFIED_AGENT
    );

    await sendOnboardingEmailWithTracking("agent-1");

    expect(sendOnboardingEmail).toHaveBeenCalledWith(
      "advertiser@example.com",
      "Advertiser",
      "ADVERTISER",
      "agent-1"
    );
    expect(prisma.agent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "agent-1" },
        data: expect.objectContaining({
          onboardingEmailSentAt: expect.any(Date),
          onboardingEmailLastAttemptAt: expect.any(Date),
          onboardingEmailLastError: null,
        }),
      })
    );
  });

  it("records the failure outcome but never throws when send fails", async () => {
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      VERIFIED_AGENT
    );
    (sendOnboardingEmail as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Failed to send onboarding email")
    );

    // No throw — onboarding is fire-and-forget from the caller's perspective.
    await expect(
      sendOnboardingEmailWithTracking("agent-1")
    ).resolves.toBeUndefined();

    const updateCall = (prisma.agent.update as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(updateCall.data.onboardingEmailLastError).toBe(
      "Failed to send onboarding email"
    );
    expect(updateCall.data.onboardingEmailLastAttemptAt).toEqual(
      expect.any(Date)
    );
    expect(updateCall.data.onboardingEmailSentAt).toBeUndefined();
  });

  it("skips silently when the agent does not exist", async () => {
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );

    await sendOnboardingEmailWithTracking("missing-agent");

    expect(sendOnboardingEmail).not.toHaveBeenCalled();
    expect(prisma.agent.update).not.toHaveBeenCalled();
  });

  it("skips silently when the agent has no email address", async () => {
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...VERIFIED_AGENT,
      email: null,
    });

    await sendOnboardingEmailWithTracking("agent-1");

    expect(sendOnboardingEmail).not.toHaveBeenCalled();
    expect(prisma.agent.update).not.toHaveBeenCalled();
  });
});

describe("resendOnboardingEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends and records success on a verified agent", async () => {
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      VERIFIED_AGENT
    );

    const result = await resendOnboardingEmail("agent-1");

    expect(result).toEqual({ email: "advertiser@example.com" });
    expect(sendOnboardingEmail).toHaveBeenCalledTimes(1);
    expect(prisma.agent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          onboardingEmailSentAt: expect.any(Date),
          onboardingEmailLastError: null,
        }),
      })
    );
  });

  it("rejects with ConflictError when the agent is still UNVERIFIED", async () => {
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...VERIFIED_AGENT,
      verificationLevel: "UNVERIFIED",
    });

    await expect(resendOnboardingEmail("agent-1")).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(sendOnboardingEmail).not.toHaveBeenCalled();
  });

  it("rejects with NotFoundError when the agent does not exist", async () => {
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );

    await expect(resendOnboardingEmail("missing")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("rejects with ValidationError when the agent has no email", async () => {
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...VERIFIED_AGENT,
      email: null,
    });

    await expect(resendOnboardingEmail("agent-1")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("records the failure and re-throws when send fails", async () => {
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      VERIFIED_AGENT
    );
    (sendOnboardingEmail as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Failed to send onboarding email")
    );

    await expect(resendOnboardingEmail("agent-1")).rejects.toThrow(
      "Failed to send onboarding email"
    );

    const updateCall = (prisma.agent.update as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(updateCall.data.onboardingEmailLastError).toBe(
      "Failed to send onboarding email"
    );
    expect(updateCall.data.onboardingEmailSentAt).toBeUndefined();
  });
});
