import { describe, expect, it } from "vitest";

import { GET } from "../route";

describe("GET /.well-known/api-catalog", () => {
  it("publishes a linkset catalog for API and agent discovery", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/linkset+json");
    expect(body.linkset).toHaveLength(2);

    expect(body.linkset[0].anchor).toBe("https://affiliateswarm.ai/api/v1");
    expect(body.linkset[0]["service-doc"][0]).toMatchObject({
      href: "https://affiliateswarm.ai/docs/api",
      type: "text/html",
    });
    expect(body.linkset[0].status[0]).toMatchObject({
      href: "https://affiliateswarm.ai/api/health",
      type: "application/json",
    });

    expect(body.linkset[1]["service-desc"][0]).toMatchObject({
      href: "https://affiliateswarm.ai/.well-known/agent-skills/index.json",
      type: "application/json",
    });
    expect(body.linkset[1]["service-doc"].map((link: { href: string }) => link.href)).toEqual([
      "https://affiliateswarm.ai/affiliate/skill.md",
      "https://affiliateswarm.ai/advertiser/skill.md",
    ]);
  });
});
