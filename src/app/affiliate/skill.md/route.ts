import { NextResponse } from "next/server";

import { renderAgentSkillContent } from "@/lib/agent-skills";

/**
 * GET /affiliate/skill.md — Serve the affiliate skill file.
 */
export async function GET() {
  const content = renderAgentSkillContent("affiliate");

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
