import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  handleCheckoutCompleted: vi.fn(),
  handleAsyncPaymentSucceeded: vi.fn(),
  handleAsyncPaymentFailed: vi.fn(),
  handleSessionExpired: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: { constructEvent: mocks.constructEvent },
  },
}));

vi.mock("@/services/stripe.service", () => ({
  handleCheckoutCompleted: mocks.handleCheckoutCompleted,
  handleAsyncPaymentSucceeded: mocks.handleAsyncPaymentSucceeded,
  handleAsyncPaymentFailed: mocks.handleAsyncPaymentFailed,
  handleSessionExpired: mocks.handleSessionExpired,
}));

import { POST } from "../route";

function buildRequest(body = "{}") {
  return new NextRequest(new URL("http://localhost:3000/api/webhooks/stripe"), {
    method: "POST",
    headers: { "stripe-signature": "sig_test" },
    body,
  });
}

describe("/api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    delete process.env.ENABLE_STRIPE_DEPOSITS;
  });

  it("verifies the signature before ignoring events when the rail is disabled", async () => {
    mocks.constructEvent.mockReturnValue({
      id: "evt_1",
      type: "charge.dispute.created",
      data: { object: { id: "du_1" } },
    });

    const res = await POST(buildRequest('{"id":"evt_1"}'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ received: true, skipped: "payment rail disabled" });
    expect(mocks.constructEvent).toHaveBeenCalledWith(
      '{"id":"evt_1"}',
      "sig_test",
      "whsec_test"
    );
    expect(mocks.handleCheckoutCompleted).not.toHaveBeenCalled();
    expect(mocks.handleAsyncPaymentSucceeded).not.toHaveBeenCalled();
    expect(mocks.handleAsyncPaymentFailed).not.toHaveBeenCalled();
    expect(mocks.handleSessionExpired).not.toHaveBeenCalled();
  });

  it("rejects unsigned requests even when the rail is disabled", async () => {
    const req = new NextRequest(
      new URL("http://localhost:3000/api/webhooks/stripe"),
      { method: "POST", body: "{}" }
    );

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mocks.constructEvent).not.toHaveBeenCalled();
  });
});
