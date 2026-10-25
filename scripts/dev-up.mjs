// One command to bring local development up after a restart:
// Docker Desktop (if it isn't running), the local Supabase stack, then the Next.js dev server.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const DOCKER = `${process.env.HOME}/.local/bin/docker`;
const AUTH_HEALTH = "http://127.0.0.1:54321/auth/v1/health";

function dockerIsUp() {
  return spawnSync(DOCKER, ["info"], { stdio: "ignore" }).status === 0;
}

async function supabaseIsUp() {
  try {
    const response = await fetch(AUTH_HEALTH, { signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
}

if (!dockerIsUp()) {
  console.log("Starting Docker Desktop...");
  execFileSync("open", ["-a", "Docker"]);
  for (let attempt = 0; attempt < 90 && !dockerIsUp(); attempt += 1) await sleep(2000);
  if (!dockerIsUp()) {
    console.error("Docker didn't start within three minutes. Open Docker Desktop by hand, then run `npm run up` again.");
    process.exit(1);
  }
}
console.log("Docker is up.");

if (!(await supabaseIsUp())) {
  console.log("Starting the local Supabase stack...");
  spawnSync("npx", ["supabase", "start"], { stdio: "inherit" });
  for (let attempt = 0; attempt < 30 && !(await supabaseIsUp()); attempt += 1) await sleep(2000);
}
console.log(await supabaseIsUp() ? "Supabase is up. Studio: http://127.0.0.1:54323  Mailpit: http://127.0.0.1:54324" : "Supabase did not answer yet; the dev server will start anyway.");

console.log("Starting the dev server at http://localhost:3000 (Ctrl+C stops it)...");
const dev = spawn("npx", ["next", "dev"], { stdio: "inherit" });
dev.on("exit", (code) => process.exit(code ?? 0));
