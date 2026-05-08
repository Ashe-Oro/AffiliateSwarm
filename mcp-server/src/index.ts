#!/usr/bin/env node
/**
 * AffiliateSwarm MCP Server — standalone entry point.
 *
 * Usage:
 *   AFFILIATESWARM_API_KEY=swarm_live_... npx regatta-mcp-server
 *
 * Or with a custom API URL:
 *   AFFILIATESWARM_API_KEY=swarm_live_... AFFILIATESWARM_API_URL=https://affiliateswarm.ai npx regatta-mcp-server
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRegattaMcpServer } from "./server.js";

async function main() {
  const apiKey = process.env.AFFILIATESWARM_API_KEY;
  const apiUrl = process.env.AFFILIATESWARM_API_URL || "https://affiliateswarm.ai";

  if (!apiKey) {
    console.error(
      "Error: AFFILIATESWARM_API_KEY environment variable is required.\n\n" +
        "  1. Register at https://affiliateswarm.ai/docs/onboarding\n" +
        "  2. Save your API key\n" +
        "  3. Run: AFFILIATESWARM_API_KEY=swarm_live_... npx regatta-mcp-server\n"
    );
    process.exit(1);
  }

  const server = createRegattaMcpServer({ apiKey, apiUrl });
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Fatal error starting AffiliateSwarm MCP server:", err);
  process.exit(1);
});
