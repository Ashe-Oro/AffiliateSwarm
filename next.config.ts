import type { NextConfig } from "next";
import { HOMEPAGE_LINK_HEADER } from "./src/lib/public-discovery";

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/",
        headers: [{ key: "Link", value: HOMEPAGE_LINK_HEADER }],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
      {
        // API CORS: agents call from any origin (server-to-server), so we allow
        // specific origins for browser requests but rely on Bearer token auth
        // (not cookies) for API security. Browsers can't forge Authorization headers.
        source: "/api/(.*)",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: process.env.NEXT_PUBLIC_APP_URL || "https://regatta.network",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PATCH, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "Content-Type, Authorization, X-Regatta-Key-Id, X-Regatta-Timestamp, X-Regatta-Signature",
          },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
