import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("@/lib/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendOnboardingEmail: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/prisma";
import { sendVerificationEmail, sendOnboardingEmail } from "@/lib/email";
import {
  sweepStaleVerificationEmails,
  sweepStaleOnboardingEmails,
} from "../agent.service";

describe("sweepStaleVerificationEmails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.agent.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  it("returns zero counts and sends nothing when no candidates match", async () => {
    (prisma.agent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await sweepStaleVerificationEmails();

    expect(result).toEqual({ found: 0, retried: 0, succeeded: 0, failed: 0 });
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("retries one candidate and records success", async () => {
    (prisma.agent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "agent-1", email: "u@example.com", emailVerifyToken: "tok123" },
    ]);

    const result = await sweepStaleVerificationEmails();

    expect(sendVerificationEmail).toHaveBeenCalledWith(
      "u@example.com",
      "tok123",
      "agent-1"
    );
    expect(result).toEqual({ found: 1, retried: 1, succeeded: 1, failed: 0 });
    // Outcome write: success branch sets sentAt + clears lastError
    expect(prisma.agent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "agent-1" },
        data: expect.objectContaining({
          verificationEmailSentAt: expect.any(Date),
          verificationEmailLastError: null,
        }),
      })
    );
  });

  it("counts mixed success and failure independently", async () => {
    (prisma.agent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "agent-1", email: "ok@example.com", emailVerifyToken: "tok1" },
      { id: "agent-2", email: "fail@example.com", emailVerifyToken: "tok2" },
    ]);
    (sendVerificationEmail as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Resend down"));

    const result = await sweepStaleVerificationEmails();

    expect(result).toEqual({ found: 2, retried: 2, succeeded: 1, failed: 1 });
    // Failure path persists the error
    const failureCall = (prisma.agent.update as ReturnType<typeof vi.fn>).mock
      .calls.find((c) => c[0].where.id === "agent-2");
    expect(failureCall?.[0].data.verificationEmailLastError).toBe("Resend down");
    expect(failureCall?.[0].data.verificationEmailSentAt).toBeUndefined();
  });

  it("filters out agents with sent / verified / expired-token / recently-attempted state", async () => {
    (prisma.agent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await sweepStaleVerificationEmails();

    // Inspect the where clause we asked Prisma for — these are the invariants
    // that prevent double-sends, sending to verified agents, sending with a
    // dead token, or hammering Resend on consecutive cron ticks.
    const whereArg = (prisma.agent.findMany as ReturnType<typeof vi.fn>).mock
      .calls[0][0].where;
    expect(whereArg.deletedAt).toBeNull();
    expect(whereArg.verificationLevel).toBe("UNVERIFIED");
    expect(whereArg.verificationEmailSentAt).toBeNull();
    expect(whereArg.email).toEqual({ not: null });
    expect(whereArg.emailVerifyToken).toEqual({ not: null });

    // "Last attempt was null OR is older than the backoff window"
    const orFilter = whereArg.OR as Array<Record<string, unknown>>;
    expect(orFilter).toContainEqual({ verificationEmailLastAttemptAt: null });
    expect(orFilter[1].verificationEmailLastAttemptAt).toEqual(
      expect.objectContaining({ lt: expect.any(Date) })
    );

    // "Token has not yet expired"
    const andFilter = whereArg.AND as Array<{
      OR: Array<Record<string, unknown>>;
    }>;
    expect(andFilter[0].OR).toContainEqual({ emailVerifyTokenExpiresAt: null });
    expect(andFilter[0].OR[1].emailVerifyTokenExpiresAt).toEqual(
      expect.objectContaining({ gt: expect.any(Date) })
    );
  });

  it("respects the batch limit", async () => {
    (prisma.agent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await sweepStaleVerificationEmails();

    expect(
      (prisma.agent.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].take
    ).toBe(50);
  });
});

describe("sweepStaleOnboardingEmails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.agent.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  it("returns zero counts when no candidates match", async () => {
    (prisma.agent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await sweepStaleOnboardingEmails();

    expect(result).toEqual({ found: 0, retried: 0, succeeded: 0, failed: 0 });
    expect(sendOnboardingEmail).not.toHaveBeenCalled();
  });

  it("delegates to sendOnboardingEmailWithTracking and counts success when sentAt is populated after", async () => {
    (prisma.agent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "agent-1" },
    ]);
    // The wrapped helper loads the agent itself; mock that lookup
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "agent-1",
      email: "verified@example.com",
      displayName: "Verified",
      type: "ADVERTISER",
    });
    (prisma.agent.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      onboardingEmailSentAt: new Date(),
    });

    const result = await sweepStaleOnboardingEmails();

    expect(sendOnboardingEmail).toHaveBeenCalledWith(
      "verified@example.com",
      "Verified",
      "ADVERTISER",
      "agent-1"
    );
    expect(result).toEqual({ found: 1, retried: 1, succeeded: 1, failed: 0 });
  });

  it("counts a candidate as failed when sentAt remains null after the send attempt", async () => {
    (prisma.agent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "agent-1" },
    ]);
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "agent-1",
      email: "verified@example.com",
      displayName: "Verified",
      type: "ADVERTISER",
    });
    // The mailer rejects; sendOnboardingEmailWithTracking swallows the error
    // and persists onboardingEmailLastError but leaves sentAt null
    (sendOnboardingEmail as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Resend exhausted")
    );
    (prisma.agent.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      onboardingEmailSentAt: null,
    });

    const result = await sweepStaleOnboardingEmails();

    expect(result).toEqual({ found: 1, retried: 1, succeeded: 0, failed: 1 });
  });

  it("filters out unverified agents and recently-attempted rows", async () => {
    (prisma.agent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await sweepStaleOnboardingEmails();

    const whereArg = (prisma.agent.findMany as ReturnType<typeof vi.fn>).mock
      .calls[0][0].where;
    expect(whereArg.deletedAt).toBeNull();
    expect(whereArg.verificationLevel).toEqual({ not: "UNVERIFIED" });
    expect(whereArg.onboardingEmailSentAt).toBeNull();

    const orFilter = whereArg.OR as Array<Record<string, unknown>>;
    expect(orFilter).toContainEqual({ onboardingEmailLastAttemptAt: null });
    expect(orFilter[1].onboardingEmailLastAttemptAt).toEqual(
      expect.objectContaining({ lt: expect.any(Date) })
    );
  });
});
