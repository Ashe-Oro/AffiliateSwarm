import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
interface RegattaConfig {
    apiKey: string;
    apiUrl: string;
}
export declare function createRegattaMcpServer(config: RegattaConfig): McpServer;
export {};
