import "dotenv/config";
import { defineConfig } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3099";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // tests are sequential — advertiser sets up, then affiliate joins
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
  ],
  webServer: {
    command: "npx next dev --port 3099",
    port: 3099,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
