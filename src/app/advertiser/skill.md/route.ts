import { NextResponse } from "next/server";

import { readAgentSkillContent } from "@/lib/agent-skills";

/**
 * GET /advertiser/skill.md — Serve the advertiser skill file.
 */
export async function GET() {
  const content = readAgentSkillContent("advertiser");

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
