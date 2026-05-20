import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  BudgetExhaustedError,
  WalletShortfallError,
} from "@/lib/errors";

const { mockGetAuthContext, mockProcessPostback } = vi.hoisted(() => ({
  mockGetAuthContext: vi.fn(),
  mockProcessPostback: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  withAuth: (handler: unknown) => handler,
  requireRole: () => (handler: unknown) => handler,
  requireEmailVerified: () => (handler: unknown) => handler,
  getAuthContext: mockGetAuthContext,
}));

vi.mock("@/services/tracking.service", () => ({
  processPostback: mockProcessPostback,
}));

import { POST } from "../route";

function buildRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/v1/postback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function expectNoFundingInternals(body: unknown) {
  const rawBody = JSON.stringify(body);
  expect(rawBody).not.toMatch(/\d+\s*cents/i);
  expect(rawBody).not.toMatch(/budget(?:Cents)?\s*[:=]/i);
  expect(rawBody).not.toMatch(/headroom/i);
  expect(rawBody).not.toMatch(/deficit/i);
  expect(rawBody).not.toMatch(/need\s+\d+\s+more/i);
  expect(rawBody).not.toContain("availableCents");
  expect(rawBody).not.toContain("walletAvailableCents");
  expect(rawBody).not.toContain("details");
  expect(rawBody).not.toContain("fundingContext");
}

describe("POST /api/v1/postback funding shortfall responses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthContext.mockReturnValue({
      agent: {
        id: "advertiser-1",
        type: "ADVERTISER",
        verificationLevel: "EMAIL_VERIFIED",
        capabilities: [],
      },
      credential: { id: "credential-1", scopes: ["*"] },
    });
  });

  it("returns a sanitized body for budget-exhausted shortfalls", async () => {
    mockProcessPostback.mockRejectedValueOnce(
      new BudgetExhaustedError({
        deficitCents: 100,
        headroomCents: 0,
        budgetCents: 1000,
      })
    );

    const res = await POST(
      buildRequest({
        swarm_ref: "abc",
        externalId: "ord_1",
        eventType: "PURCHASE",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toMatchInlineSnapshot(`
      {
        "error": {
          "code": "CAMPAIGN_BUDGET_EXHAUSTED",
          "message": "Campaign budget exhausted",
        },
        "success": false,
      }
    `);
    expectNoFundingInternals(body);
  });

  it("returns a sanitized body for wallet-shortfall responses", async () => {
    mockProcessPostback.mockRejectedValueOnce(
      new WalletShortfallError({
        deficitCents: 500,
        walletAvailableCents: 100,
      })
    );

    const res = await POST(
      buildRequest({
        swarm_ref: "abc",
        externalId: "ord_2",
        eventType: "PURCHASE",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toMatchInlineSnapshot(`
      {
        "error": {
          "code": "ADVERTISER_WALLET_INSUFFICIENT_BALANCE",
          "message": "Insufficient advertiser wallet balance",
        },
        "success": false,
      }
    `);
    expectNoFundingInternals(body);
  });

  it("returns synthetic lead identifiers for test confirmation postbacks", async () => {
    mockProcessPostback.mockResolvedValueOnce({
      test: true,
      id: "test-lead-id",
      leadId: "test-lead-id",
      created: false,
      campaignId: "campaign-1",
      externalId: "test-confirm-1",
      trackingConfirmedAt: new Date("2026-05-20T16:00:00.000Z"),
      message:
        "Test postback received — tracking confirmed. You can now activate this campaign.",
    });

    const res = await POST(
      buildRequest({
        swarm_ref: "TEST1234",
        externalId: "test-confirm-1",
        eventType: "PURCHASE",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchInlineSnapshot(`
      {
        "data": {
          "campaignId": "campaign-1",
          "created": false,
          "externalId": "test-confirm-1",
          "id": "test-lead-id",
          "leadId": "test-lead-id",
          "message": "Test postback received — tracking confirmed. You can now activate this campaign.",
          "test": true,
          "trackingConfirmedAt": "2026-05-20T16:00:00.000Z",
        },
        "success": true,
      }
    `);
  });
});
