import { NextRequest } from "next/server";
import { withAuth, getAuthContext } from "@/lib/auth/middleware";
import { successResponse } from "@/lib/api-response";
import { ensureUserAccount, createLoginCode, CODE_TTL_MS } from "@/lib/auth/login-code";

export const POST = withAuth(async (req: NextRequest) => {
  const { agent } = getAuthContext(req);

  const userId = await ensureUserAccount(agent);
  const code = await createLoginCode(agent.id, userId);

  return successResponse({
    code,
    expiresInSeconds: CODE_TTL_MS / 1000,
    loginUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login`,
  });
});
