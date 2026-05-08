export { generateApiKey, verifyApiKey, extractKeyPrefix } from "./api-keys";
export type { GeneratedApiKey } from "./api-keys";

export { signRequest, verifySignature, HMAC_HEADERS } from "./hmac";
export type { HmacVerifyParams, HmacVerifyResult } from "./hmac";

export { withAuth, getAuthContext } from "./middleware";
export type { AuthContext } from "./middleware";

export { withRateLimit } from "./rate-limit";

export {
  generateLoginCode,
  ensureUserAccount,
  createLoginCode,
  checkIpRateLimit,
  CODE_TTL_MS,
} from "./login-code";

export { requireRole, requireEmailVerified } from "./rbac";
export type { Role } from "./rbac";

export { hashPassword, verifyPassword } from "./password";

export {
  createSession,
  validateSession,
  destroySession,
  getSessionFromRequest,
  SESSION_COOKIE,
  SESSION_DURATION_MS,
} from "./session";
export type { SessionData } from "./session";

export {
  getDashboardUser,
  withDashboardAuth,
  requireDashboardAuth,
  requireAdvertiserAgent,
} from "./dashboard";
export type { DashboardUser } from "./dashboard";
