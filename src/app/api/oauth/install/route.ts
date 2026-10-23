import { connection, NextResponse } from "next/server";
import { installUrl } from "@/lib/ghl/oauth";

// A stable link Tom can open to install the app on a sub-account.
export async function GET() {
  // Build the URL at request time, not at build time, so it always reflects the current env.
  await connection();
  return NextResponse.redirect(installUrl());
}
