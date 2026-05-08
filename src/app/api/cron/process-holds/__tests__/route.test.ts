import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/services/escrow.service", () => ({
  processMaturedHolds: vi.fn(),
}));

import { NextRequest } from "next/server";
import { GET } from "../route";
import { processMaturedHolds } from "@/services/escrow.service";

const CRON_SECRET = "test-cron-secret";

function buildRequest(withAuth: boolean = true): NextRequest {
  const headers: Record<string, string> = {};
  if (withAuth) {
    headers.authorization = `Bearer ${CRON_SECRET}`;
  }
  return new NextRequest(
    new URL("http://localhost:3000/api/cron/process-holds"),
    { method: "GET", headers }
  );
}

describe("/api/cron/process-holds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
  });

  it("returns 401 without authorization header", async () => {
    const res = await GET(buildRequest(false));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 401 with wrong secret", async () => {
    const req = new NextRequest(
      new URL("http://localhost:3000/api/cron/process-holds"),
      { method: "GET", headers: { authorization: "Bearer wrong-secret" } }
    );
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when CRON_SECRET env is not set", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(buildRequest(true));
    expect(res.status).toBe(401);
  });

  it("processes matured holds and returns results", async () => {
    (processMaturedHolds as ReturnType<typeof vi.fn>).mockResolvedValue({
      processed: 3,
      failed: 1,
    });

    const res = await GET(buildRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.processed).toBe(3);
    expect(json.failed).toBe(1);
    expect(processMaturedHolds).toHaveBeenCalledOnce();
  });

  it("returns 500 when processMaturedHolds throws", async () => {
    (processMaturedHolds as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("DB connection lost")
    );

    const res = await GET(buildRequest());
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("Internal error");
  });
});
