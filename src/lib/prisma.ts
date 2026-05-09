import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { TEST_API_KEY_PREFIX } from "@/lib/brand";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  sandboxPrisma: PrismaClient | undefined;
};

function createPrismaClient(connectionString?: string): PrismaClient {
  const connStr = connectionString || process.env.DATABASE_URL;
  if (!connStr) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  const adapter = new PrismaPg({ connectionString: connStr });
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
