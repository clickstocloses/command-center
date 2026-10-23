import { execFileSync } from "node:child_process";

// Every RLS run starts from the migrations plus seed, so tests never depend on
// leftovers from a previous run.
export default function globalSetup() {
  execFileSync("npx", ["supabase", "db", "reset"], { stdio: "inherit" });
}
