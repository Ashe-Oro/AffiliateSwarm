import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeStringify from "rehype-stringify";
import { prisma } from "@/lib/prisma";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

export interface BlogPostFrontmatter {
  title: string;
  description: string;
  date: string; // ISO 8601
  author: string;
  authorType?: "human" | "agent";
  tags?: string[];
  featured?: boolean;
  coverImage?: string;
}

export interface BlogPostMeta extends BlogPostFrontmatter {
  slug: string;
  readingTimeMinutes: number;
  source: "file" | "db";
}

export interface BlogPost extends BlogPostMeta {
  contentHtml: string;
}

function estimateReadingTime(markdown: string): number {
  const wordsPerMinute = 220;
  const words = markdown.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / wordsPerMinute));
}

async function readPostFile(slug: string): Promise<{
  raw: string;
  data: Record<string, unknown>;
  content: string;
}> {
  const filePath = path.join(BLOG_DIR, `${slug}.md`);
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = matter(raw);
  return { raw, data: parsed.data, content: parsed.content };
}

function validateFrontmatter(
  data: Record<string, unknown>,
  slug: string
): BlogPostFrontmatter {
  const required = ["title", "description", "date", "author"];
  for (const key of required) {
    if (typeof data[key] !== "string" || !data[key]) {
      throw new Error(
        `Blog post "${slug}" is missing required frontmatter field "${key}"`
      );
    }
  }
  const dateObj = new Date(String(data.date));
  if (Number.isNaN(dateObj.getTime())) {
    throw new Error(`Blog post "${slug}" has invalid date "${data.date}"`);
  }
  return {
    title: String(data.title),
    description: String(data.description),
    date: dateObj.toISOString(),
    author: String(data.author),
    authorType: data.authorType === "agent" ? "agent" : "human",
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    featured: Boolean(data.featured),
    coverImage: typeof data.coverImage === "string" ? data.coverImage : undefined,
  };
}

export async function getAllFilePostSlugs(): Promise<string[]> {
  try {
    const entries = await fs.readdir(BLOG_DIR);
    return entries
      .filter((name) => name.endsWith(".md"))
      .filter((name) => !name.startsWith("_") && name !== "README.md")
      .map((name) => name.replace(/\.md$/, ""));
  } catch {
    return [];
  }
}

/**
 * All post slugs (file + DB). Used by generateStaticParams() to prerender
 * blog post pages. DB slugs that appear after build still render dynamically
 * (Next.js defaults to dynamicParams = true).
 */
export async function getAllPostSlugs(): Promise<string[]> {
  const fileSlugs = await getAllFilePostSlugs();
  const fileSet = new Set(fileSlugs);
  let dbSlugs: string[] = [];
  try {
    const rows = await prisma.blogPost.findMany({
      where: { deletedAt: null },
      select: { slug: true },
    });
    dbSlugs = rows.map((r) => r.slug).filter((s) => !fileSet.has(s));
  } catch {
    dbSlugs = [];
  }
  return [...fileSlugs, ...dbSlugs];
}

async function getFilePostMeta(slug: string): Promise<BlogPostMeta | null> {
  try {
    const { data, content } = await readPostFile(slug);
    const fm = validateFrontmatter(data, slug);
    return {
      ...fm,
      slug,
      readingTimeMinutes: estimateReadingTime(content),
      source: "file",
    };
  } catch {
    return null;
  }
}

async function getDbPostMeta(row: {
  slug: string;
  title: string;
  description: string;
  content: string;
  authorName: string;
  authorType: string;
  tags: string[];
  featured: boolean;
  coverImage: string | null;
  publishedAt: Date;
}): Promise<BlogPostMeta> {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    date: row.publishedAt.toISOString(),
    author: row.authorName,
    authorType: row.authorType === "agent" ? "agent" : "human",
    tags: row.tags ?? [],
    featured: row.featured,
    coverImage: row.coverImage ?? undefined,
    readingTimeMinutes: estimateReadingTime(row.content),
    source: "db",
  };
}

export async function getAllPostMeta(): Promise<BlogPostMeta[]> {
  // File-based posts take precedence on slug collision — they are source-
  // controlled and versioned, while DB posts are edit-in-place.
  const fileSlugs = await getAllFilePostSlugs();
  const fileMetas = (
    await Promise.all(fileSlugs.map(getFilePostMeta))
  ).filter((m): m is BlogPostMeta => m !== null);
  const fileSlugSet = new Set(fileMetas.map((m) => m.slug));

  let dbRows: Array<{
    slug: string;
    title: string;
    description: string;
    content: string;
    authorName: string;
    authorType: string;
    tags: string[];
    featured: boolean;
    coverImage: string | null;
    publishedAt: Date;
  }> = [];
  try {
    dbRows = await prisma.blogPost.findMany({
      where: { deletedAt: null },
      orderBy: { publishedAt: "desc" },
      select: {
        slug: true,
        title: true,
        description: true,
        content: true,
        authorName: true,
        authorType: true,
        tags: true,
        featured: true,
        coverImage: true,
        publishedAt: true,
      },
    });
  } catch {
    // DB unreachable at build time — fall back to file posts only.
    dbRows = [];
  }

  const dbMetas = (
    await Promise.all(dbRows.filter((r) => !fileSlugSet.has(r.slug)).map(getDbPostMeta))
  );

  return [...fileMetas, ...dbMetas].sort((a, b) => b.date.localeCompare(a.date));
}

async function renderMarkdownToHtml(markdown: string): Promise<string> {
  const processed = await remark()
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, {
      behavior: "append",
      properties: {
        className: ["heading-anchor"],
        ariaLabel: "Link to this section",
      },
    })
    .use(rehypeStringify)
    .process(markdown);
  return String(processed);
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  // Try file-based first so file posts always win on collision.
  try {
    const { data, content } = await readPostFile(slug);
    const fm = validateFrontmatter(data, slug);
    const contentHtml = await renderMarkdownToHtml(content);
    return {
      ...fm,
      slug,
      readingTimeMinutes: estimateReadingTime(content),
      source: "file",
      contentHtml,
    };
  } catch {
    // Fall through to DB lookup
  }

  try {
    const row = await prisma.blogPost.findUnique({
      where: { slug },
    });
    if (!row || row.deletedAt) return null;
    const contentHtml = await renderMarkdownToHtml(row.content);
    return {
      slug: row.slug,
      title: row.title,
      description: row.description,
      date: row.publishedAt.toISOString(),
      author: row.authorName,
      authorType: row.authorType === "agent" ? "agent" : "human",
      tags: row.tags ?? [],
      featured: row.featured,
      coverImage: row.coverImage ?? undefined,
      readingTimeMinutes: estimateReadingTime(row.content),
      source: "db",
      contentHtml,
    };
  } catch {
    return null;
  }
}
