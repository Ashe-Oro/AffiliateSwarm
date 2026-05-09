import { prisma } from "@/lib/prisma";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import type {
  CreateBlogPostInput,
  UpdateBlogPostInput,
} from "@/lib/validators/blog";
import type { BlogPost } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Slug generation
// ---------------------------------------------------------------------------

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

/**
 * Generate a slug from a title and, if needed, append a numeric suffix until
 * it no longer collides with an existing DB post or a reserved file slug.
 */
async function uniqueSlug(
  desired: string,
  reservedSlugs: Set<string> = new Set()
): Promise<string> {
  const base = slugify(desired);
  if (!base) throw new ValidationError("Could not generate a slug from the title");

  let candidate = base;
  let suffix = 1;
  while (true) {
    const collision =
      reservedSlugs.has(candidate) ||
      (await prisma.blogPost.findUnique({ where: { slug: candidate } })) !== null;
    if (!collision) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
    if (suffix > 1000) {
      throw new ConflictError("Could not allocate a unique slug after 1000 attempts");
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CreateBlogPostOptions {
  reservedSlugs?: Set<string>;
  defaultAuthor?: string;
}

export async function createBlogPost(
  input: CreateBlogPostInput,
  opts: CreateBlogPostOptions = {}
): Promise<BlogPost> {
  const authorName = input.author ?? opts.defaultAuthor ?? "AffiliateSwarm Agent";

  let slug: string;
  if (input.slug) {
    const reserved = opts.reservedSlugs?.has(input.slug) ?? false;
    const existing = await prisma.blogPost.findUnique({ where: { slug: input.slug } });
    if (reserved || existing) {
      throw new ConflictError(`A post with slug "${input.slug}" already exists`);
    }
    slug = input.slug;
  } else {
    slug = await uniqueSlug(input.title, opts.reservedSlugs);
  }

  return prisma.blogPost.create({
    data: {
      slug,
      title: input.title,
      description: input.description,
      content: input.content,
      authorName,
      authorType: "agent",
      tags: input.tags ?? [],
      featured: input.featured ?? false,
      coverImage: input.coverImage,
      publishedAt: input.publishedAt ? new Date(input.publishedAt) : new Date(),
    },
  });
}

export async function updateBlogPost(
  slug: string,
  input: UpdateBlogPostInput
): Promise<BlogPost> {
  const existing = await prisma.blogPost.findUnique({ where: { slug } });
  if (!existing || existing.deletedAt) {
    throw new NotFoundError("BlogPost", slug);
  }

  return prisma.blogPost.update({
    where: { slug },
    data: {
      title: input.title ?? undefined,
      description: input.description ?? undefined,
      content: input.content ?? undefined,
      authorName: input.author ?? undefined,
      tags: input.tags ?? undefined,
      featured: input.featured ?? undefined,
      coverImage: input.coverImage ?? undefined,
      publishedAt: input.publishedAt ? new Date(input.publishedAt) : undefined,
    },
  });
}

export async function softDeleteBlogPost(slug: string): Promise<BlogPost> {
  const existing = await prisma.blogPost.findUnique({ where: { slug } });
  if (!existing || existing.deletedAt) {
    throw new NotFoundError("BlogPost", slug);
  }
  return prisma.blogPost.update({
    where: { slug },
    data: { deletedAt: new Date() },
  });
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const post = await prisma.blogPost.findUnique({ where: { slug } });
  if (!post || post.deletedAt) return null;
  return post;
}

export async function listBlogPosts(opts: { limit?: number } = {}): Promise<BlogPost[]> {
  return prisma.blogPost.findMany({
    where: { deletedAt: null },
    orderBy: { publishedAt: "desc" },
    take: opts.limit,
  });
}
