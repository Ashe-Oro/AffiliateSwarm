import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  PostbackSchema,
  CreateReferralSchema,
  ConfirmReferralSchema,
  EvidenceItemSchema,
} from "@/lib/validators/tracking";
import { SubmitLeadSchema } from "@/lib/validators/lead";

// ---------------------------------------------------------------------------
// 1. PostbackSchema
// ---------------------------------------------------------------------------

describe("PostbackSchema", () => {
  const validInput = {
    rgta_ref: "abc123",
    externalId: "order_456",
    eventType: "PURCHASE" as const,
  };

  it("accepts valid minimal input", () => {
    const result = PostbackSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("accepts valid input with all optional fields", () => {
    const result = PostbackSchema.safeParse({
      ...validInput,
      revenueCents: 9900,
      metadata: { orderId: "order_456" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing rgta_ref", () => {
    const { rgta_ref, ...rest } = validInput;
    void rgta_ref;
    const result = PostbackSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing externalId", () => {
    const { externalId, ...rest } = validInput;
    const result = PostbackSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects invalid eventType", () => {
    const result = PostbackSchema.safeParse({
      ...validInput,
      eventType: "INVALID",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative revenueCents", () => {
    const result = PostbackSchema.safeParse({
      ...validInput,
      revenueCents: -100,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. CreateReferralSchema
// ---------------------------------------------------------------------------

describe("CreateReferralSchema", () => {
  const validInput = {
    campaignId: "550e8400-e29b-41d4-a716-446655440000",
  };

  it("accepts valid minimal input and applies defaults", () => {
    const result = CreateReferralSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.expiresInHours).toBe(720);
    }
  });

  it("accepts valid input with all optional fields", () => {
    const result = CreateReferralSchema.safeParse({
      ...validInput,
      metadata: { context: "recommendation" },
      expiresInHours: 48,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.expiresInHours).toBe(48);
    }
  });

  it("rejects non-uuid campaignId", () => {
    const result = CreateReferralSchema.safeParse({
      campaignId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects expiresInHours less than 1", () => {
    const result = CreateReferralSchema.safeParse({
      ...validInput,
      expiresInHours: 0,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. ConfirmReferralSchema
// ---------------------------------------------------------------------------

describe("ConfirmReferralSchema", () => {
  it("accepts empty object", () => {
    const result = ConfirmReferralSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts valid input with all fields", () => {
    const result = ConfirmReferralSchema.safeParse({
      revenueCents: 5000,
      metadata: { note: "confirmed" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative revenueCents", () => {
    const result = ConfirmReferralSchema.safeParse({
      revenueCents: -1,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. EvidenceItemSchema
// ---------------------------------------------------------------------------

describe("EvidenceItemSchema", () => {
  it("accepts valid evidence item", () => {
    const result = EvidenceItemSchema.safeParse({
      type: "tweet",
      url: "https://twitter.com/example/status/123",
      description: "Promoted the product",
    });
    expect(result.success).toBe(true);
  });

  it("accepts minimal evidence item (type only)", () => {
    const result = EvidenceItemSchema.safeParse({
      type: "blog_post",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid evidence type", () => {
    const result = EvidenceItemSchema.safeParse({
      type: "invalid_type",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid url", () => {
    const result = EvidenceItemSchema.safeParse({
      type: "tweet",
      url: "not-a-url",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. SubmitLeadSchema with evidence
// ---------------------------------------------------------------------------

describe("SubmitLeadSchema with evidence", () => {
  const validLead = {
    campaignId: "550e8400-e29b-41d4-a716-446655440000",
  };

  it("accepts lead with evidence array", () => {
    const result = SubmitLeadSchema.safeParse({
      ...validLead,
      evidence: [
        { type: "tweet", url: "https://twitter.com/test/status/1" },
        { type: "blog_post", description: "Review post" },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.evidence).toHaveLength(2);
    }
  });

  it("accepts lead without evidence", () => {
    const result = SubmitLeadSchema.safeParse(validLead);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.evidence).toBeUndefined();
    }
  });

  it("rejects evidence array exceeding 10 items", () => {
    const evidence = Array.from({ length: 11 }, () => ({
      type: "tweet" as const,
    }));
    const result = SubmitLeadSchema.safeParse({
      ...validLead,
      evidence,
    });
    expect(result.success).toBe(false);
  });
});
