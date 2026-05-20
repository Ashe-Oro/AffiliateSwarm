import { describe, it, expect, beforeAll, vi } from "vitest";
import { sendPostback } from "../postback";

beforeAll(() => {
  process.env.AFFILIATESWARM_API_BASE = "https://api.example.com";
});

describe("sendPostback", () => {
  const body = {
    swarm_ref: "abc123ef",
    externalId: "shopify_1_2",
    eventType: "PURCHASE" as const,
    revenueCents: 1234,
  };

  it("returns success and extracts leadId on 200", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, data: { leadId: "lead_xyz" } }), { status: 200 }),
    );
    const result = await sendPostback("key", body, { fetcher });
    expect(result).toEqual({ status: "success", leadId: "lead_xyz", attempts: 1 });
  });

  it("treats 4xx as permanent failure with no retries", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(
      new Response("bad key", { status: 401 }),
    );
    const result = await sendPostback("key", body, { fetcher });
    expect(result.status).toBe("permanent_failure");
    if (result.status === "permanent_failure") {
      expect(result.httpStatus).toBe(401);
      expect(result.attempts).toBe(1);
    }
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("retries on 5xx then succeeds", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("oops", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { leadId: "ok" } }), { status: 200 }));
    const result = await sendPostback("key", body, { fetcher });
    expect(result).toEqual({ status: "success", leadId: "ok", attempts: 2 });
  });

  it("returns transient_failure after exhausting retries on 5xx", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("nope", { status: 502 }));
    const result = await sendPostback("key", body, { fetcher });
    expect(result.status).toBe("transient_failure");
    if (result.status === "transient_failure") {
      expect(result.attempts).toBe(3);
    }
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("returns transient_failure on fetch errors", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    const result = await sendPostback("key", body, { fetcher });
    expect(result.status).toBe("transient_failure");
    if (result.status === "transient_failure") {
      expect(result.error).toContain("ECONNRESET");
    }
  });
});
