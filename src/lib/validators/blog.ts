import { z } from "zod";

// ---------------------------------------------------------------------------
// Blog post validation
// ---------------------------------------------------------------------------
// These schemas gate the public POST/PUT endpoints under /api/v1/blog-posts.
// Size caps are intentionally generous (200kB of markdown is ~35k words) so
// agents can publish long-form posts without hitting artificial limits.

const TITLE_MAX = 255;
const DESCRIPTION_MAX = 500;
const CONTENT_MAX = 200_000;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const SlugSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(
    SLUG_REGEX,
    "Slug must be lowercase letters, digits, and hyphens (e.g. 'my-post-title')"
  );

export const CreateBlogPostSchema = z.object({
  slug: SlugSchema.optional(),
  title: z.string().min(1).max(TITLE_MAX),
  description: z.string().min(1).max(DESCRIPTION_MAX),
  content: z.string().min(1).max(CONTENT_MAX),
  author: z.string().min(1).max(TITLE_MAX).optional(),
  tags: z.array(z.string().min(1).max(64)).max(20).optional(),
  featured: z.boolean().optional(),
  coverImage: z.string().url().max(2048).optional(),
  publishedAt: z.string().datetime().optional(),
});

export const UpdateBlogPostSchema = z.object({
  title: z.string().min(1).max(TITLE_MAX).optional(),
  description: z.string().min(1).max(DESCRIPTION_MAX).optional(),
  content: z.string().min(1).max(CONTENT_MAX).optional(),
  author: z.string().min(1).max(TITLE_MAX).optional(),
  tags: z.array(z.string().min(1).max(64)).max(20).optional(),
  featured: z.boolean().optional(),
  coverImage: z.string().url().max(2048).optional(),
  publishedAt: z.string().datetime().optional(),
});

export type CreateBlogPostInput = z.infer<typeof CreateBlogPostSchema>;
export type UpdateBlogPostInput = z.infer<typeof UpdateBlogPostSchema>;
