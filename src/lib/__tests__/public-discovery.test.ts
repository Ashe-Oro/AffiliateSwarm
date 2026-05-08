import { describe, expect, it } from "vitest";

import { HOMEPAGE_LINK_HEADER } from "@/lib/public-discovery";

describe("homepage discovery Link header", () => {
  it("advertises API, health, and skill discovery resources", () => {
    expect(HOMEPAGE_LINK_HEADER).toContain("</.well-known/api-catalog>");
    expect(HOMEPAGE_LINK_HEADER).toContain('rel="service-desc"');
    expect(HOMEPAGE_LINK_HEADER).toContain("</docs/api>");
    expect(HOMEPAGE_LINK_HEADER).toContain('rel="service-doc"');
    expect(HOMEPAGE_LINK_HEADER).toContain("</api/health>");
    expect(HOMEPAGE_LINK_HEADER).toContain('rel="status"');
    expect(HOMEPAGE_LINK_HEADER).toContain("</.well-known/agent-skills/index.json>");
    expect(HOMEPAGE_LINK_HEADER).toContain("</affiliate/skill.md>");
    expect(HOMEPAGE_LINK_HEADER).toContain("</advertiser/skill.md>");
  });
});
