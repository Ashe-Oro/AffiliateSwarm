import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { CreateBlogPostSchema } from "@/lib/validators/blog";
import { createBlogPost, listBlogPosts } from "@/services/blog.service";
import { assertBlogApiKey } from "@/lib/auth/blog-publisher";
import { getAllFilePostSlugs } from "@/lib/blog/posts";
import { AppError } from "@/lib/errors";

const DEFAULT_AUTHOR =
  process.env.BLOG_DEFAULT_AUTHOR ?? "Regatta";

/**
 * POST /api/v1/blog-posts — Create a blog post.
 * Auth: Authorization: Bearer <BLOG_API_KEY>. No Agent / apiCredential lookup.
 */
export async function POST(req: NextRequest) {
  try {
    assertBlogApiKey(req);

    const body = await req.json();
    const parsed = CreateBlogPostSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid blog post data",
        400,
        parsed.error.issues
      );
    }

    // File-based post slugs are reserved (they take precedence on read).
    const reservedSlugs = new Set(await getAllFilePostSlugs());

    const post = await createBlogPost(parsed.data, {
      reservedSlugs,
      defaultAuthor: DEFAULT_AUTHOR,
    });

    return successResponse(
      {
        id: post.id,
        slug: post.slug,
        title: post.title,
        description: post.description,
        authorName: post.authorName,
        authorType: post.authorType,
        tags: post.tags,
        featured: post.featured,
        coverImage: post.coverImage,
        publishedAt: post.publishedAt,
        url: `/blog/${post.slug}`,
      },
      201
    );
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("Blog post create error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to create blog post", 500);
  }
}

/**
 * GET /api/v1/blog-posts — Public list of DB-backed blog posts. File-based
 * posts (source-controlled) are not included; they're always visible on
 * /blog directly.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1),
      200
    );
    const posts = await listBlogPosts({ limit });
    return successResponse(
      posts.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        description: p.description,
        authorName: p.authorName,
        authorType: p.authorType,
        tags: p.tags,
        featured: p.featured,
        coverImage: p.coverImage,
        publishedAt: p.publishedAt,
        url: `/blog/${p.slug}`,
      }))
    );
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("Blog post list error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to list blog posts", 500);
  }
}
