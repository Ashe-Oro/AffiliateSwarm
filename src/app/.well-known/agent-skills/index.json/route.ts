import { NextResponse } from "next/server";

import { getAgentSkillsIndex } from "@/lib/agent-skills";

export function GET() {
  return NextResponse.json(getAgentSkillsIndex(), {
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  });
}
