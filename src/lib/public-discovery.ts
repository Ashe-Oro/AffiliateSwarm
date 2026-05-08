import type { BlogPostMeta } from "@/lib/blog/posts";
import { DEFAULT_APP_URL, PRODUCT_NAME } from "./brand";

export type SitemapEntry = {
  path: string;
  changefreq?: "daily" | "weekly" | "monthly" | "yearly";
  priority?: number;
  lastmod?: string;
};

const publicPageEntries: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: 1.0 },
  { path: "/for-affiliates", changefreq: "weekly", priority: 0.9 },
  { path: "/for-advertisers", changefreq: "weekly", priority: 0.9 },
  { path: "/pricing", changefreq: "monthly", priority: 0.7 },
  { path: "/docs", changefreq: "weekly", priority: 0.8 },
  { path: "/docs/api", changefreq: "weekly", priority: 0.9 },
  { path: "/docs/integration", changefreq: "weekly", priority: 0.8 },
  { path: "/docs/tracking", changefreq: "weekly", priority: 0.8 },
  { path: "/docs/onboarding", changefreq: "weekly", priority: 0.8 },
  { path: "/docs/architecture", changefreq: "monthly", priority: 0.6 },
  { path: "/docs/mcp-setup", changefreq: "monthly", priority: 0.5 },
  { path: "/docs/llm-integration-guide.md", changefreq: "monthly", priority: 0.7 },
  { path: "/affiliate/skill.md", changefreq: "weekly", priority: 0.9 },
  { path: "/advertiser/skill.md", changefreq: "monthly", priority: 0.7 },
  { path: "/blog", changefreq: "weekly", priority: 0.7 },
  { path: "/privacy", changefreq: "yearly", priority: 0.3 },
  { path: "/terms", changefreq: "yearly", priority: 0.3 },
];

export function getPublicBaseUrl(baseUrl = process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL) {
  return baseUrl.replace(/\/+$/, "");
}

export function absoluteUrl(path: string, baseUrl?: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getPublicBaseUrl(baseUrl)}${normalizedPath}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatPriority(priority?: number): string | undefined {
  if (priority == null) return undefined;
  return priority.toFixed(1);
}

export function getPublicSitemapEntries(posts: BlogPostMeta[] = []): SitemapEntry[] {
  const blogEntries = posts.map((post) => ({
    path: `/blog/${post.slug}`,
    changefreq: "monthly" as const,
    priority: 0.6,
    lastmod: post.date,
  }));

  return [...publicPageEntries, ...blogEntries];
}

export function buildSitemapXml(entries: SitemapEntry[], baseUrl?: string): string {
  const urls = entries
    .map((entry) => {
      const lastmod = entry.lastmod
        ? `<lastmod>${escapeXml(new Date(entry.lastmod).toISOString())}</lastmod>`
        : "";
      const changefreq = entry.changefreq
        ? `<changefreq>${entry.changefreq}</changefreq>`
        : "";
      const priority = formatPriority(entry.priority);
      const priorityTag = priority ? `<priority>${priority}</priority>` : "";

      return `  <url><loc>${escapeXml(absoluteUrl(entry.path, baseUrl))}</loc>${lastmod}${changefreq}${priorityTag}</url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function buildRobotsTxt(baseUrl?: string): string {
  const root = getPublicBaseUrl(baseUrl);

  return [
    `# ${PRODUCT_NAME} crawler policy`,
    "# Public marketing, documentation, blog, and agent skill pages are crawlable.",
    "# Private dashboards, admin, auth, test, cron, and API mutation surfaces are not for crawlers.",
    "",
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /admin-login",
    "Disallow: /dashboard",
    "Disallow: /login",
    "Disallow: /onboarding",
    "Disallow: /api/",
    "",
    "# AI crawler policy: allow agents/search crawlers to discover public docs and skills.",
    "User-agent: GPTBot",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /dashboard",
    "Disallow: /api/",
    "",
    "User-agent: OAI-SearchBot",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /dashboard",
    "Disallow: /api/",
    "",
    "User-agent: Claude-Web",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /dashboard",
    "Disallow: /api/",
    "",
    "# We allow public search/discovery use; training-use policy can be revisited separately.",
    "User-agent: Google-Extended",
    "Disallow: /",
    "",
    `Sitemap: ${root}/sitemap.xml`,
    "",
  ].join("\n");
}

export function getApiCatalog(baseUrl?: string) {
  const root = getPublicBaseUrl(baseUrl);

  return {
    linkset: [
      {
        anchor: `${root}/api/v1`,
        "service-doc": [
          {
            href: `${root}/docs/api`,
            type: "text/html",
            title: `${PRODUCT_NAME} public API documentation`,
          },
        ],
        status: [
          {
            href: `${root}/api/health`,
            type: "application/json",
            title: `${PRODUCT_NAME} API health`,
          },
        ],
      },
      {
        anchor: root,
        "service-desc": [
          {
            href: `${root}/.well-known/agent-skills/index.json`,
            type: "application/json",
            title: `${PRODUCT_NAME} agent skills discovery index`,
          },
        ],
        "service-doc": [
          {
            href: `${root}/affiliate/skill.md`,
            type: "text/markdown",
            title: `${PRODUCT_NAME} affiliate skill`,
          },
          {
            href: `${root}/advertiser/skill.md`,
            type: "text/markdown",
            title: `${PRODUCT_NAME} advertiser skill`,
          },
        ],
      },
    ],
  };
}

export const HOMEPAGE_LINK_HEADER = [
  `</.well-known/api-catalog>; rel="service-desc"; type="application/linkset+json"; title="${PRODUCT_NAME} API catalog"`,
  `</docs/api>; rel="service-doc"; type="text/html"; title="${PRODUCT_NAME} API docs"`,
  `</api/health>; rel="status"; type="application/json"; title="${PRODUCT_NAME} API health"`,
  `</.well-known/agent-skills/index.json>; rel="service-desc"; type="application/json"; title="${PRODUCT_NAME} agent skills index"`,
  `</affiliate/skill.md>; rel="service-doc"; type="text/markdown"; title="${PRODUCT_NAME} affiliate skill"`,
  `</advertiser/skill.md>; rel="service-doc"; type="text/markdown"; title="${PRODUCT_NAME} advertiser skill"`,
].join(", ");
