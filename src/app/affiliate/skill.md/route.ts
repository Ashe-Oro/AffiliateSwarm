import { NextResponse } from "next/server";

import { readAgentSkillContent } from "@/lib/agent-skills";

/**
 * GET /affiliate/skill.md — Serve the affiliate skill file.
 */
export async function GET() {
  const content = readAgentSkillContent("affiliate");

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
