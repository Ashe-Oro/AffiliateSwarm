import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

let cachedContent: string | null = null;

function getGuideContent(): string {
  if (cachedContent) return cachedContent;
  cachedContent = readFileSync(
    join(process.cwd(), "docs/llm-integration-guide.md"),
    "utf-8"
  );
  return cachedContent;
}

/**
 * GET /docs/llm-integration-guide.md — Serve the LLM integration guide as raw markdown.
 */
export async function GET(req: NextRequest) {
  const content = getGuideContent();

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
