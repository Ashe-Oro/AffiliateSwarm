import { describe, expect, it } from "vitest";

import { GET } from "../route";

describe("GET /robots.txt", () => {
  it("publishes crawler policy with sitemap and AI crawler rules", async () => {
    const res = await GET();
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(body).toContain("User-agent: *");
    expect(body).toContain("Disallow: /admin");
    expect(body).toContain("Disallow: /dashboard");
    expect(body).toContain("Disallow: /api/");
    expect(body).toContain("User-agent: GPTBot");
    expect(body).toContain("User-agent: OAI-SearchBot");
    expect(body).toContain("User-agent: Claude-Web");
    expect(body).toContain("User-agent: Google-Extended");
    expect(body).toContain("Sitemap: https://affiliateswarm.ai/sitemap.xml");
  });
});
