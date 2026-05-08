import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/chain/deposit-scanner", () => ({
  scanForDeposits: vi.fn(),
}));

import { NextRequest } from "next/server";
import { GET } from "../route";
import { scanForDeposits } from "@/lib/chain/deposit-scanner";

const CRON_SECRET = "test-cron-secret";

function buildRequest(withAuth: boolean = true): NextRequest {
  const headers: Record<string, string> = {};
  if (withAuth) {
    headers.authorization = `Bearer ${CRON_SECRET}`;
  }
  return new NextRequest(
    new URL("http://localhost:3000/api/cron/detect-deposits"),
    { method: "GET", headers }
  );
}

describe("/api/cron/detect-deposits", () => {
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
      new URL("http://localhost:3000/api/cron/detect-deposits"),
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

  it("returns scan results on success", async () => {
    (scanForDeposits as ReturnType<typeof vi.fn>).mockResolvedValue({
      blockRange: { from: 8000n, to: 10000n },
      depositsFound: 3,
      depositsProcessed: 2,
      depositsSkipped: 1,
      dustDepositsSkipped: 1,
      errors: [],
    });

    const res = await GET(buildRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.depositsFound).toBe(3);
    expect(json.depositsProcessed).toBe(2);
    expect(json.depositsSkipped).toBe(1);
    expect(json.dustDepositsSkipped).toBe(1);
    expect(json.errors).toBe(0);
    expect(json.blockRange.from).toBe("8000");
    expect(json.blockRange.to).toBe("10000");
    expect(scanForDeposits).toHaveBeenCalledOnce();
  });

  it("returns 500 when scanForDeposits throws", async () => {
    (scanForDeposits as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("RPC connection failed")
    );

    const res = await GET(buildRequest());
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.ok).toBe(false);
    expect(json.error).toBe("Deposit detection failed");
  });
});
