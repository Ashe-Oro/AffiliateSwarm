import { describe, it, expect, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { assertBlogApiKey } from "@/lib/auth/blog-publisher";
import { AuthError, ForbiddenError } from "@/lib/errors";

const URL_FOR_TEST = "http://localhost:3000/api/v1/blog-posts";

function req(authHeader?: string): NextRequest {
  return new NextRequest(URL_FOR_TEST, {
    method: "POST",
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

const originalEnv = process.env.BLOG_API_KEY;

afterEach(() => {
  if (originalEnv === undefined) delete process.env.BLOG_API_KEY;
  else process.env.BLOG_API_KEY = originalEnv;
});

describe("assertBlogApiKey", () => {
  it("fails closed when BLOG_API_KEY is unset", () => {
    delete process.env.BLOG_API_KEY;
    expect(() => assertBlogApiKey(req("Bearer anything"))).toThrow(ForbiddenError);
  });

  it("fails closed when BLOG_API_KEY is empty string", () => {
    process.env.BLOG_API_KEY = "";
    expect(() => assertBlogApiKey(req("Bearer anything"))).toThrow(ForbiddenError);
  });

  it("rejects when Authorization header is missing", () => {
    process.env.BLOG_API_KEY = "correct-key";
    expect(() => assertBlogApiKey(req())).toThrow(AuthError);
  });

  it("rejects when Authorization header is not Bearer", () => {
    process.env.BLOG_API_KEY = "correct-key";
    expect(() => assertBlogApiKey(req("Basic dXNlcjpwYXNz"))).toThrow(AuthError);
  });

  it("rejects a wrong key", () => {
    process.env.BLOG_API_KEY = "correct-key";
    expect(() => assertBlogApiKey(req("Bearer wrong-key"))).toThrow(AuthError);
  });

  it("rejects a key with matching prefix but different length", () => {
    process.env.BLOG_API_KEY = "correct-key";
    expect(() => assertBlogApiKey(req("Bearer correct-key-extra"))).toThrow(
      AuthError
    );
  });

  it("accepts the correct bearer key", () => {
    process.env.BLOG_API_KEY = "correct-key";
    expect(() => assertBlogApiKey(req("Bearer correct-key"))).not.toThrow();
  });

  it("accepts 'bearer' case-insensitively", () => {
    process.env.BLOG_API_KEY = "correct-key";
    expect(() => assertBlogApiKey(req("bearer correct-key"))).not.toThrow();
  });
});
