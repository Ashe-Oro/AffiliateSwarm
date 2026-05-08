import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { SlugSchema, UpdateBlogPostSchema } from "@/lib/validators/blog";
import {
  getBlogPostBySlug,
  softDeleteBlogPost,
  updateBlogPost,
} from "@/services/blog.service";
import { assertBlogApiKey } from "@/lib/auth/blog-publisher";
import { AppError, NotFoundError } from "@/lib/errors";

type RouteContext = { params: Promise<{ slug: string }> };

async function parseSlug(ctx: RouteContext) {
  const { slug } = await ctx.params;
  const parsed = SlugSchema.safeParse(slug);
  if (!parsed.success) {
    throw new NotFoundError("BlogPost", slug);
  }
  return parsed.data;
}

/**
 * GET /api/v1/blog-posts/:slug — Public. Returns 404 for file-based posts
 * (those are static markdown served directly from /blog/:slug).
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const slug = await parseSlug(ctx);
    const post = await getBlogPostBySlug(slug);
    if (!post) {
      return errorResponse("NOT_FOUND", `BlogPost '${slug}' not found`, 404);
    }
    return successResponse({
      id: post.id,
      slug: post.slug,
      title: post.title,
      description: post.description,
      content: post.content,
      authorName: post.authorName,
      authorType: post.authorType,
      tags: post.tags,
      featured: post.featured,
      coverImage: post.coverImage,
      publishedAt: post.publishedAt,
      updatedAt: post.updatedAt,
      url: `/blog/${post.slug}`,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("Blog post get error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to fetch blog post", 500);
  }
}

/**
 * PUT /api/v1/blog-posts/:slug — Update a post. Requires the shared
 * BLOG_API_KEY bearer.
 */
export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    assertBlogApiKey(req);
    const slug = await parseSlug(ctx);

    const body = await req.json();
    const parsed = UpdateBlogPostSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid blog post data",
        400,
        parsed.error.issues
      );
    }

    const post = await updateBlogPost(slug, parsed.data);
    return successResponse({
      id: post.id,
      slug: post.slug,
      title: post.title,
      updatedAt: post.updatedAt,
      url: `/blog/${post.slug}`,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("Blog post update error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to update blog post", 500);
  }
}

/**
 * DELETE /api/v1/blog-posts/:slug — Soft-delete (sets deletedAt). Requires
 * the BLOG_API_KEY bearer.
 */
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  try {
    assertBlogApiKey(req);
    const slug = await parseSlug(ctx);
    await softDeleteBlogPost(slug);
    return successResponse({ slug, deleted: true });
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("Blog post delete error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to delete blog post", 500);
  }
}
