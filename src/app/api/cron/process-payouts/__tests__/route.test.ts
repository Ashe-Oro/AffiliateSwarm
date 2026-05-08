import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    payoutRequest: { findMany: vi.fn() },
  },
}));

vi.mock("@/services/chain.service", () => ({
  sendPayout: vi.fn(),
  recoverStuckPayout: vi.fn(),
}));

vi.mock("@/services/stripe.service", () => ({
  processAchPayout: vi.fn(),
}));

const mockResendSend = vi.fn();
vi.mock("@/lib/email", () => ({
  getResend: () => ({ emails: { send: mockResendSend } }),
  FROM: "test@example.com",
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { NextRequest } from "next/server";
import { GET } from "../route";
import { prisma } from "@/lib/prisma";
import { sendPayout, recoverStuckPayout } from "@/services/chain.service";
import { processAchPayout } from "@/services/stripe.service";

const CRON_SECRET = "test-cron-secret";

function buildRequest(withAuth = true): NextRequest {
  const headers: Record<string, string> = {};
  if (withAuth) headers.authorization = `Bearer ${CRON_SECRET}`;
  return new NextRequest(
    new URL("http://localhost:3000/api/cron/process-payouts"),
    { method: "GET", headers }
  );
}

const mockFindMany = prisma.payoutRequest.findMany as ReturnType<typeof vi.fn>;
const mockSend = sendPayout as ReturnType<typeof vi.fn>;
const mockAch = processAchPayout as ReturnType<typeof vi.fn>;
const mockRecover = recoverStuckPayout as ReturnType<typeof vi.fn>;

/**
 * The route calls findMany twice per tick: once for PENDING, once for stuck
 * PROCESSING. Route each query to the right mock result based on the where
 * clause so tests don't have to juggle call order.
 */
function routeFindMany(opts: {
  pending?: unknown[];
  stuck?: unknown[];
}) {
  mockFindMany.mockImplementation((args: { where: { status: string } }) => {
    if (args.where.status === "PENDING") {
      return Promise.resolve(opts.pending ?? []);
    }
    if (args.where.status === "PROCESSING") {
      return Promise.resolve(opts.stuck ?? []);
    }
    return Promise.resolve([]);
  });
}

describe("/api/cron/process-payouts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
    delete process.env.ADMIN_ALERT_EMAIL;
  });

  // ---- Auth ----------------------------------------------------------------

  it("returns 401 without authorization header", async () => {
    const res = await GET(buildRequest(false));
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong secret", async () => {
    const req = new NextRequest(
      new URL("http://localhost:3000/api/cron/process-payouts"),
      { method: "GET", headers: { authorization: "Bearer wrong" } }
    );
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when CRON_SECRET env is not set", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(buildRequest(true));
    expect(res.status).toBe(401);
  });

  // ---- PENDING pass --------------------------------------------------------

  it("returns zero counts when nothing is pending or stuck", async () => {
    routeFindMany({});

    const res = await GET(buildRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.total).toBe(0);
    expect(json.processed).toBe(0);
    expect(json.stuckFound).toBe(0);
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockAch).not.toHaveBeenCalled();
    expect(mockRecover).not.toHaveBeenCalled();
  });

  it("routes CRYPTO payouts to sendPayout and BANK_TRANSFER to processAchPayout", async () => {
    routeFindMany({
      pending: [
        { id: "p1", method: "CRYPTO" },
        { id: "p2", method: "BANK_TRANSFER" },
      ],
    });
    mockSend.mockResolvedValue({ success: true, txHash: "0xabc" });
    mockAch.mockResolvedValue({ success: true, transferId: "tr_1" });

    const res = await GET(buildRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.processed).toBe(2);
    expect(json.failed).toBe(0);
    expect(mockSend).toHaveBeenCalledWith("p1");
    expect(mockAch).toHaveBeenCalledWith("p2");
  });

  it("counts a failed sendPayout result as failed without aborting the batch", async () => {
    routeFindMany({
      pending: [
        { id: "p1", method: "CRYPTO" },
        { id: "p2", method: "CRYPTO" },
      ],
    });
    mockSend
      .mockResolvedValueOnce({ success: false, error: "gas error" })
      .mockResolvedValueOnce({ success: true, txHash: "0xdef" });

    const res = await GET(buildRequest());
    const json = await res.json();

    expect(json.processed).toBe(1);
    expect(json.failed).toBe(1);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("skips unsupported methods", async () => {
    routeFindMany({
      pending: [{ id: "p1", method: "PLATFORM_CREDIT" }],
    });

    const res = await GET(buildRequest());
    const json = await res.json();

    expect(json.skipped).toBe(1);
    expect(mockSend).not.toHaveBeenCalled();
  });

  // ---- PROCESSING recovery pass -------------------------------------------

  it("recovers stuck PROCESSING rows by outcome type", async () => {
    routeFindMany({
      stuck: [
        { id: "r1" },
        { id: "r2" },
        { id: "r3" },
        { id: "r4" },
      ],
    });
    mockRecover
      .mockResolvedValueOnce({ outcome: "reset_to_pending" })
      .mockResolvedValueOnce({ outcome: "finalized_completed" })
      .mockResolvedValueOnce({ outcome: "finalized_failed" })
      .mockResolvedValueOnce({ outcome: "in_flight_skipped" });

    const res = await GET(buildRequest());
    const json = await res.json();

    expect(json.stuckFound).toBe(4);
    expect(json.recoveredReset).toBe(1);
    expect(json.recoveredCompleted).toBe(1);
    expect(json.recoveredFailed).toBe(1);
    expect(json.recoveredInFlight).toBe(1);
    expect(json.recoverErrors).toBe(0);
    expect(mockRecover).toHaveBeenCalledWith("r1");
    expect(mockRecover).toHaveBeenCalledWith("r2");
    expect(mockRecover).toHaveBeenCalledWith("r3");
    expect(mockRecover).toHaveBeenCalledWith("r4");
  });

  it("counts recoverStuckPayout throws as recoverErrors and continues", async () => {
    routeFindMany({ stuck: [{ id: "r1" }, { id: "r2" }] });
    mockRecover
      .mockRejectedValueOnce(new Error("DB blip"))
      .mockResolvedValueOnce({ outcome: "reset_to_pending" });

    const res = await GET(buildRequest());
    const json = await res.json();

    expect(json.recoverErrors).toBe(1);
    expect(json.recoveredReset).toBe(1);
  });

  it("runs both passes independently in a single tick", async () => {
    routeFindMany({
      pending: [{ id: "p1", method: "CRYPTO" }],
      stuck: [{ id: "r1" }],
    });
    mockSend.mockResolvedValue({ success: true, txHash: "0x1" });
    mockRecover.mockResolvedValue({ outcome: "finalized_completed" });

    const res = await GET(buildRequest());
    const json = await res.json();

    expect(json.processed).toBe(1);
    expect(json.recoveredCompleted).toBe(1);
  });

  // ---- Alerting ------------------------------------------------------------

  it("sends an admin alert email when failed > 0 and env is configured", async () => {
    process.env.ADMIN_ALERT_EMAIL = "admin@example.com";
    routeFindMany({
      pending: [{ id: "p1", method: "CRYPTO" }],
    });
    mockSend.mockResolvedValue({ success: false, error: "boom" });

    const res = await GET(buildRequest());
    expect(res.status).toBe(200);

    // Fire-and-forget: allow the void promise to resolve
    await new Promise((r) => setTimeout(r, 0));

    expect(mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin@example.com",
        subject: expect.stringContaining("process-payouts"),
      })
    );
  });

  it("does not email when ADMIN_ALERT_EMAIL is unset", async () => {
    routeFindMany({ pending: [{ id: "p1", method: "CRYPTO" }] });
    mockSend.mockResolvedValue({ success: false, error: "boom" });

    await GET(buildRequest());
    await new Promise((r) => setTimeout(r, 0));

    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("does not email when all passes succeed", async () => {
    process.env.ADMIN_ALERT_EMAIL = "admin@example.com";
    routeFindMany({
      pending: [{ id: "p1", method: "CRYPTO" }],
      stuck: [{ id: "r1" }],
    });
    mockSend.mockResolvedValue({ success: true, txHash: "0x1" });
    mockRecover.mockResolvedValue({ outcome: "finalized_completed" });

    await GET(buildRequest());
    await new Promise((r) => setTimeout(r, 0));

    expect(mockResendSend).not.toHaveBeenCalled();
  });

  // ---- Error path ---------------------------------------------------------

  it("returns 500 when the PENDING query throws", async () => {
    mockFindMany.mockRejectedValue(new Error("DB down"));
    const res = await GET(buildRequest());
    expect(res.status).toBe(500);
  });
});
