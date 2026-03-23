import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
    // Global retry: retry each failed test up to 2 times (helps with transient DB issues)
    retry: 2,
    // Increase default test timeout to 30s (DB operations can be slow when TiDB is recovering)
    testTimeout: 30_000,
    // Increase hook timeout for beforeAll/afterAll that set up DB state
    hookTimeout: 30_000,
  },
});
