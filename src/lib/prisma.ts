import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { TEST_API_KEY_PREFIX } from "@/lib/brand";
import { logger } from "@/lib/logger";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  sandboxPrisma: PrismaClient | undefined;
};

function readPositiveInt(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createPoolConfig(connectionString?: string) {
  const connStr = connectionString || process.env.DATABASE_URL;
  if (!connStr) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const queryTimeoutMs = readPositiveInt("DATABASE_QUERY_TIMEOUT_MS", 15_000);

  return {
    connectionString: connStr,
    max: readPositiveInt(
      "DATABASE_POOL_MAX",
      process.env.NODE_ENV === "production" ? 1 : 10
    ),
    connectionTimeoutMillis: readPositiveInt(
      "DATABASE_CONNECTION_TIMEOUT_MS",
      5_000
    ),
    idleTimeoutMillis: readPositiveInt("DATABASE_IDLE_TIMEOUT_MS", 10_000),
    // pg-pool supports maxLifetimeSeconds; it rotates long-lived warm clients.
    maxLifetimeSeconds: readPositiveInt("DATABASE_MAX_LIFETIME_SECONDS", 60),
    query_timeout: queryTimeoutMs,
    statement_timeout: readPositiveInt(
      "DATABASE_STATEMENT_TIMEOUT_MS",
      queryTimeoutMs
    ),
    // pg forwards these as PostgreSQL startup parameters on each connection.
    lock_timeout: readPositiveInt("DATABASE_LOCK_TIMEOUT_MS", 5_000),
    idle_in_transaction_session_timeout: readPositiveInt(
      "DATABASE_IDLE_TRANSACTION_TIMEOUT_MS",
      queryTimeoutMs
    ),
  };
}

function createPrismaClient(connectionString?: string): PrismaClient {
  // PrismaPgOptions in @prisma/adapter-pg 7.x exposes these error callbacks.
  const adapter = new PrismaPg(createPoolConfig(connectionString), {
    onPoolError: (err) => {
      logger.error({ err }, "Postgres pool error");
    },
    onConnectionError: (err) => {
      logger.error({ err }, "Postgres connection error");
    },
  });
  return new PrismaClient({ adapter }) as PrismaClient;
}

// Production database client
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// ---------------------------------------------------------------------------
// Sandbox database client (lazy-init, separate connection)
// ---------------------------------------------------------------------------

function getSandboxPrisma(): PrismaClient | null {
  const sandboxUrl = process.env.SANDBOX_DATABASE_URL;
  if (!sandboxUrl) return null;

  if (!globalForPrisma.sandboxPrisma) {
    globalForPrisma.sandboxPrisma = createPrismaClient(sandboxUrl);
  }
  return globalForPrisma.sandboxPrisma;
}

/**
 * Get the appropriate Prisma client based on the API key prefix.
 * Keys starting with `swarm_test_` route to the sandbox database.
 * Keys starting with `swarm_live_` route to the production database.
 *
 * Returns production client if no sandbox database is configured.
 */
export function getPrismaForKey(apiKeyPrefix: string): PrismaClient {
  if (apiKeyPrefix.startsWith(TEST_API_KEY_PREFIX)) {
    const sandbox = getSandboxPrisma();
    if (sandbox) return sandbox;
  }
  return prisma;
}
