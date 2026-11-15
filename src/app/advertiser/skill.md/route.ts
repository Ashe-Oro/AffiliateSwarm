import { NextResponse } from "next/server";

import { renderAgentSkillContent } from "@/lib/agent-skills";

/**
 * GET /advertiser/skill.md — Serve the advertiser skill file.
 */
export async function GET() {
  const content = renderAgentSkillContent("advertiser");

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
