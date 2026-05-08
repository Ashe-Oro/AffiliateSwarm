import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { AuthError, ForbiddenError } from "@/lib/errors";

/**
 * Gates the blog publishing endpoints with a single shared bearer secret.
 * The secret lives in BLOG_API_KEY — not tied to any Agent. Fail-closed: if
 * the env var is unset or empty, every request is rejected.
 *
 * Uses a constant-time compare so an attacker can't learn the key length or
 * any prefix bytes by timing the response.
 */
export function assertBlogApiKey(req: NextRequest): void {
  const expected = process.env.BLOG_API_KEY ?? "";
  if (!expected) {
    throw new ForbiddenError(
      "Blog publishing is not configured. Set BLOG_API_KEY."
    );
  }

  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new AuthError("Missing Authorization: Bearer header");
  }
  const provided = match[1].trim();

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (
    providedBuf.length !== expectedBuf.length ||
    !timingSafeEqual(providedBuf, expectedBuf)
  ) {
    throw new AuthError("Invalid blog API key");
  }
}
