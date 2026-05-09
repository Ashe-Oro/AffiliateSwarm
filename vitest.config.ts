import { defineConfig, defaultExclude } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    exclude: [...defaultExclude, "tests/**", ".next/**", ".claude/**", ".a5c/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
