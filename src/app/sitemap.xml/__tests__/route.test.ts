import { describe, expect, it } from "vitest";

import { buildSitemapXml, getPublicSitemapEntries } from "@/lib/public-discovery";

describe("sitemap.xml discovery helpers", () => {
  it("lists canonical public pages and excludes private app surfaces", () => {
    const xml = buildSitemapXml(getPublicSitemapEntries(), "https://regatta.network");

    expect(xml).toContain("<loc>https://regatta.network/</loc>");
    expect(xml).toContain("<loc>https://regatta.network/for-affiliates</loc>");
    expect(xml).toContain("<loc>https://regatta.network/for-advertisers</loc>");
    expect(xml).toContain("<loc>https://regatta.network/docs/api</loc>");
    expect(xml).toContain("<loc>https://regatta.network/affiliate/skill.md</loc>");
    expect(xml).toContain("<loc>https://regatta.network/advertiser/skill.md</loc>");
    expect(xml).not.toContain("/dashboard");
    expect(xml).not.toContain("/admin");
    expect(xml).not.toContain("/api/v1");
  });

  it("adds public blog posts with lastmod dates", () => {
    const xml = buildSitemapXml(
      getPublicSitemapEntries([
        {
          slug: "hello-regatta",
          title: "Hello Regatta",
          description: "Intro",
          date: "2026-04-01T00:00:00.000Z",
          author: "Regatta",
          authorType: "human",
          tags: [],
          featured: false,
          readingTimeMinutes: 1,
          source: "file",
        },
      ]),
      "https://regatta.network"
    );

    expect(xml).toContain("<loc>https://regatta.network/blog/hello-regatta</loc>");
    expect(xml).toContain("<lastmod>2026-04-01T00:00:00.000Z</lastmod>");
  });
});
