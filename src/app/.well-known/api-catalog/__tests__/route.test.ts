import { describe, expect, it } from "vitest";

import { GET } from "../route";

describe("GET /.well-known/api-catalog", () => {
  it("publishes a linkset catalog for API and agent discovery", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/linkset+json");
    expect(body.linkset).toHaveLength(2);

    expect(body.linkset[0].anchor).toBe("https://your-deployment.example/api/v1");
    expect(body.linkset[0]["service-doc"][0]).toMatchObject({
      href: "https://your-deployment.example/docs/api",
      type: "text/html",
    });
    expect(body.linkset[0].status[0]).toMatchObject({
      href: "https://your-deployment.example/api/health",
      type: "application/json",
    });

    expect(body.linkset[1]["service-desc"][0]).toMatchObject({
      href: "https://your-deployment.example/.well-known/agent-skills/index.json",
      type: "application/json",
    });
    expect(body.linkset[1]["service-doc"].map((link: { href: string }) => link.href)).toEqual([
      "https://your-deployment.example/affiliate/skill.md",
      "https://your-deployment.example/advertiser/skill.md",
    ]);
  });
});
