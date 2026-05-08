#!/usr/bin/env node
/**
 * Regatta MCP Server — standalone entry point.
 *
 * Usage:
 *   REGATTA_API_KEY=rgt_live_... npx regatta-mcp-server
 *
 * Or with a custom API URL:
 *   REGATTA_API_KEY=rgt_live_... REGATTA_API_URL=https://regatta.network npx regatta-mcp-server
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRegattaMcpServer } from "./server.js";

async function main() {
  const apiKey = process.env.REGATTA_API_KEY;
  const apiUrl = process.env.REGATTA_API_URL || "https://regatta.network";

  if (!apiKey) {
    console.error(
      "Error: REGATTA_API_KEY environment variable is required.\n\n" +
        "  1. Register at https://regatta.network/docs/onboarding\n" +
        "  2. Save your API key\n" +
        "  3. Run: REGATTA_API_KEY=rgt_live_... npx regatta-mcp-server\n"
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
  console.error("Fatal error starting Regatta MCP server:", err);
  process.exit(1);
});
