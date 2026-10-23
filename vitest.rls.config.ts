import { defineConfig } from "vitest/config";

// RLS tests hit the local Supabase stack, so they run on their own:
// one database, no file parallelism, a longer timeout.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/rls/**/*.test.ts"],
    globalSetup: ["tests/rls/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
