import { connection, NextResponse } from "next/server";
import { OAUTH_STATE_COOKIE, installUrl, newOauthState } from "@/lib/ghl/oauth";

// A stable link Tom can open to install the app on a sub-account.
export async function GET() {
  // Build the URL at request time, not at build time, so it always reflects the current env.
  await connection();

  const state = newOauthState();
  const response = NextResponse.redirect(installUrl(state));
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/oauth",
    maxAge: 10 * 60,
  });
  return response;
}
