import { describe, expect, it } from "vitest";

import { buildSitemapXml, getPublicSitemapEntries } from "@/lib/public-discovery";

describe("sitemap.xml discovery helpers", () => {
  it("lists canonical public pages and excludes private app surfaces", () => {
    const xml = buildSitemapXml(getPublicSitemapEntries(), "https://your-deployment.example");

    expect(xml).toContain("<loc>https://your-deployment.example/</loc>");
    expect(xml).toContain("<loc>https://your-deployment.example/for-affiliates</loc>");
    expect(xml).toContain("<loc>https://your-deployment.example/for-advertisers</loc>");
    expect(xml).toContain("<loc>https://your-deployment.example/docs/api</loc>");
    expect(xml).toContain("<loc>https://your-deployment.example/affiliate/skill.md</loc>");
    expect(xml).toContain("<loc>https://your-deployment.example/advertiser/skill.md</loc>");
    expect(xml).not.toContain("/dashboard");
    expect(xml).not.toContain("/admin");
    expect(xml).not.toContain("/api/v1");
  });

  it("adds public blog posts with lastmod dates", () => {
    const xml = buildSitemapXml(
      getPublicSitemapEntries([
        {
          slug: "sample-post",
          title: "Sample Post",
          description: "Intro",
          date: "2026-04-01T00:00:00.000Z",
          author: "AffiliateSwarm",
          authorType: "human",
          tags: [],
          featured: false,
          readingTimeMinutes: 1,
          source: "file",
        },
      ]),
      "https://your-deployment.example"
    );

    expect(xml).toContain("<loc>https://your-deployment.example/blog/sample-post</loc>");
    expect(xml).toContain("<lastmod>2026-04-01T00:00:00.000Z</lastmod>");
  });
});
