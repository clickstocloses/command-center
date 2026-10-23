// Runs the RLS tests when the local Supabase stack is up, otherwise says so and
// exits clean. Keeps `npm run check` usable on a machine that hasn't started Docker.
import { spawnSync } from "node:child_process";

const LOCAL_AUTH_HEALTH = "http://127.0.0.1:54321/auth/v1/health";

async function localStackIsUp() {
  try {
    const response = await fetch(LOCAL_AUTH_HEALTH, { signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
}

if (!(await localStackIsUp())) {
  console.log("RLS tests skipped: local Supabase is not running. Start it with `npm run db:start`.");
  process.exit(0);
}

const result = spawnSync("npx", ["vitest", "run", "--config", "vitest.rls.config.ts"], { stdio: "inherit" });
process.exit(result.status ?? 1);
