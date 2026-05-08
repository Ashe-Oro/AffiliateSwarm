import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  ...(process.env.NODE_ENV !== "production" && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true },
    },
  }),
});

/**
 * Create a child logger scoped to a specific context.
 * Usage: const log = childLogger({ agentId, campaignId });
 */
export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
