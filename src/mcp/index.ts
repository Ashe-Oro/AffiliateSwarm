#!/usr/bin/env node
/**
 * AffiliateSwarm MCP Server — stdio entry point.
 *
 * Usage:
 *   AFFILIATESWARM_AGENT_ID=<uuid> npx tsx src/mcp/index.ts
 *
 * Or via package.json script:
 *   AFFILIATESWARM_AGENT_ID=<uuid> npm run mcp
 *
 * This is designed to be pointed at by an MCP-capable client (e.g. Claude Desktop,
 * OpenClaw, or any agent that speaks MCP over stdio).
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRegattaMcpServer } from "./server";

async function main() {
  const agentId = process.env.AFFILIATESWARM_AGENT_ID;

  if (!agentId) {
    console.error(
      "Error: AFFILIATESWARM_AGENT_ID environment variable is required.\n" +
        "Set it to your agent UUID before starting the MCP server.\n\n" +
        "  AFFILIATESWARM_AGENT_ID=<your-agent-id> npm run mcp"
    );
    process.exit(1);
  }

  const server = createRegattaMcpServer(agentId);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Graceful shutdown
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
