import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "generators/**/*.test.ts", "tests/**/*.test.ts"],
    // RLS tests need the local Supabase stack and run through vitest.rls.config.ts
    exclude: ["tests/rls/**", "node_modules/**"],
  },
});
