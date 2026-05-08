import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    blogPost: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  slugify,
  createBlogPost,
  updateBlogPost,
  softDeleteBlogPost,
  getBlogPostBySlug,
} from "@/services/blog.service";
import { CreateBlogPostSchema, UpdateBlogPostSchema, SlugSchema } from "@/lib/validators/blog";
import { ConflictError, NotFoundError } from "@/lib/errors";

const mockFindUnique = prisma.blogPost.findUnique as ReturnType<typeof vi.fn>;
const mockCreate = prisma.blogPost.create as ReturnType<typeof vi.fn>;
const mockUpdate = prisma.blogPost.update as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// slugify
// ---------------------------------------------------------------------------

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("strips punctuation", () => {
    expect(slugify("What's Up, Doc?!")).toBe("whats-up-doc");
  });

  it("strips diacritics", () => {
    expect(slugify("Café Résumé")).toBe("cafe-resume");
  });

  it("collapses repeated spaces and hyphens", () => {
    expect(slugify("  too    many  ---  dashes ")).toBe("too-many-dashes");
  });

  it("truncates long inputs", () => {
    const slug = slugify("x".repeat(300));
    expect(slug.length).toBeLessThanOrEqual(200);
  });
});

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

describe("CreateBlogPostSchema", () => {
  const valid = {
    title: "My Post",
    description: "A short summary.",
    content: "# Hello\n\nSome markdown.",
  };

  it("accepts minimal valid input", () => {
    expect(CreateBlogPostSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts all optional fields", () => {
    const full = {
      ...valid,
      slug: "my-post",
      author: "Agent X",
      tags: ["ai", "platform"],
      featured: true,
      coverImage: "https://example.com/cover.png",
      publishedAt: "2026-04-19T12:00:00Z",
    };
    expect(CreateBlogPostSchema.safeParse(full).success).toBe(true);
  });

  it("rejects empty title", () => {
    expect(CreateBlogPostSchema.safeParse({ ...valid, title: "" }).success).toBe(false);
  });

  it("rejects bad slug format", () => {
    const bad = CreateBlogPostSchema.safeParse({ ...valid, slug: "My Post!" });
    expect(bad.success).toBe(false);
  });

  it("rejects content over 200k chars", () => {
    const huge = CreateBlogPostSchema.safeParse({
      ...valid,
      content: "x".repeat(200_001),
    });
    expect(huge.success).toBe(false);
  });

  it("rejects non-URL coverImage", () => {
    const bad = CreateBlogPostSchema.safeParse({
      ...valid,
      coverImage: "not-a-url",
    });
    expect(bad.success).toBe(false);
  });
});

describe("SlugSchema", () => {
  it.each([
    "hello",
    "hello-world",
    "post-123",
    "a-b-c-d",
  ])("accepts valid slug %s", (slug) => {
    expect(SlugSchema.safeParse(slug).success).toBe(true);
  });

  it.each([
    "Hello",
    "hello world",
    "-hello",
    "hello-",
    "hello--world",
    "hello!",
    "",
  ])("rejects invalid slug '%s'", (slug) => {
    expect(SlugSchema.safeParse(slug).success).toBe(false);
  });
});

describe("UpdateBlogPostSchema", () => {
  it("accepts empty object (no-op update)", () => {
    expect(UpdateBlogPostSchema.safeParse({}).success).toBe(true);
  });

  it("accepts partial update", () => {
    expect(UpdateBlogPostSchema.safeParse({ title: "New Title" }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createBlogPost
// ---------------------------------------------------------------------------

describe("createBlogPost", () => {
  const input = {
    title: "First Post",
    description: "Summary",
    content: "Body",
  };

  it("generates a slug from the title when none provided", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ slug: "first-post" });

    await createBlogPost(input);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: "first-post" }),
      })
    );
  });

  it("appends a numeric suffix when base slug collides", async () => {
    mockFindUnique
      .mockResolvedValueOnce({ slug: "first-post" }) // base collides
      .mockResolvedValueOnce(null); // first-post-2 is free
    mockCreate.mockResolvedValue({ slug: "first-post-2" });

    await createBlogPost(input);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: "first-post-2" }),
      })
    );
  });

  it("treats file-based reserved slugs as collisions", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ slug: "first-post-2" });

    await createBlogPost(input, {
      reservedSlugs: new Set(["first-post"]),
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: "first-post-2" }),
      })
    );
  });

  it("throws ConflictError when an explicit slug is already taken", async () => {
    mockFindUnique.mockResolvedValue({ slug: "taken" });

    await expect(
      createBlogPost({ ...input, slug: "taken" })
    ).rejects.toThrow(ConflictError);
  });

  it("throws ConflictError when an explicit slug matches a reserved file slug", async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(
      createBlogPost(
        { ...input, slug: "hello-regatta" },
        { reservedSlugs: new Set(["hello-regatta"]) }
      )
    ).rejects.toThrow(ConflictError);
  });

  it("defaults authorType to 'agent' and uses defaultAuthor when no author given", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({});

    await createBlogPost(input, { defaultAuthor: "My AI" });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          authorName: "My AI",
          authorType: "agent",
        }),
      })
    );
  });

  it("prefers explicit author over defaultAuthor", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({});

    await createBlogPost(
      { ...input, author: "Explicit Name" },
      { defaultAuthor: "Default Name" }
    );

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ authorName: "Explicit Name" }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// updateBlogPost / softDeleteBlogPost
// ---------------------------------------------------------------------------

describe("updateBlogPost", () => {
  it("throws NotFoundError when the post doesn't exist", async () => {
    mockFindUnique.mockResolvedValue(null);
    await expect(
      updateBlogPost("missing", { title: "New" })
    ).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError when the post is soft-deleted", async () => {
    mockFindUnique.mockResolvedValue({
      slug: "x",
      deletedAt: new Date(),
    });
    await expect(updateBlogPost("x", { title: "New" })).rejects.toThrow(
      NotFoundError
    );
  });

  it("updates fields that are provided and skips undefined ones", async () => {
    mockFindUnique.mockResolvedValue({ slug: "x", deletedAt: null });
    mockUpdate.mockResolvedValue({ slug: "x", title: "New" });

    const result = await updateBlogPost("x", { title: "New" });
    expect(result.title).toBe("New");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: "x" },
        data: expect.objectContaining({ title: "New" }),
      })
    );
  });
});

describe("softDeleteBlogPost", () => {
  it("sets deletedAt", async () => {
    mockFindUnique.mockResolvedValue({ slug: "x", deletedAt: null });
    mockUpdate.mockResolvedValue({ slug: "x", deletedAt: new Date() });

    await softDeleteBlogPost("x");

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: "x" },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      })
    );
  });

  it("throws NotFoundError for already-deleted post", async () => {
    mockFindUnique.mockResolvedValue({ slug: "x", deletedAt: new Date() });
    await expect(softDeleteBlogPost("x")).rejects.toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// getBlogPostBySlug
// ---------------------------------------------------------------------------

describe("getBlogPostBySlug", () => {
  it("returns null for missing posts", async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await getBlogPostBySlug("missing")).toBeNull();
  });

  it("returns null for soft-deleted posts", async () => {
    mockFindUnique.mockResolvedValue({ slug: "x", deletedAt: new Date() });
    expect(await getBlogPostBySlug("x")).toBeNull();
  });

  it("returns the post when present and not deleted", async () => {
    const row = { slug: "x", deletedAt: null, title: "t" };
    mockFindUnique.mockResolvedValue(row);
    expect(await getBlogPostBySlug("x")).toBe(row);
  });
});
