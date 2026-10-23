import { NextResponse, type NextRequest } from "next/server";
import { writeAuditLog } from "@/lib/audit/log";
import { saveInstallation, type LocationProfile } from "@/lib/ghl/installations";
import { fetchLocationWithToken } from "@/lib/ghl/locations";
import { OAUTH_STATE_COOKIE, exchangeCodeForTokens, verifyOauthState } from "@/lib/ghl/oauth";

export const INSTALL_RESULT_COOKIE = "install_result";

/**
 * HighLevel sends the person here after they approve the install.
 * Code -> tokens -> location profile -> encrypted row -> audit -> done page.
 * Nothing secret goes into a URL or a log line.
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const code = request.nextUrl.searchParams.get("code");
  const deniedReason = request.nextUrl.searchParams.get("error");

  if (deniedReason || !code) {
    return NextResponse.redirect(new URL(`/install/error?reason=${deniedReason ? "denied" : "no_code"}`, origin));
  }

  const stateCheck = verifyOauthState(
    request.nextUrl.searchParams.get("state"),
    request.cookies.get(OAUTH_STATE_COOKIE)?.value ?? null,
  );
  if (stateCheck === "mismatch") {
    console.error("oauth callback: state mismatch");
    return NextResponse.redirect(new URL("/install/error?reason=state", origin));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    let profile: LocationProfile = { name: null, timezone: null, website: null, companyId: null };
    try {
      profile = await fetchLocationWithToken(tokens.accessToken, tokens.locationId);
    } catch (cause) {
      // The install still counts. The name can be fixed from the admin later.
      console.error("oauth callback: location lookup failed", cause instanceof Error ? cause.message : cause);
    }

    const saved = await saveInstallation(tokens, profile);

    await writeAuditLog({
      actorType: "system",
      actorId: tokens.userId,
      clientId: saved.clientId,
      action: "ghl.install",
      targetTable: "ghl_installations",
      targetId: saved.installationId,
      after: { location_id: tokens.locationId, scopes: tokens.scopes, new_client: saved.isNewClient },
    });

    const done = NextResponse.redirect(new URL("/install/done", origin));
    done.cookies.delete({ name: OAUTH_STATE_COOKIE, path: "/api/oauth" });
    // The done page shows the name from this cookie, so it never has to query by a client-supplied id.
    done.cookies.set(INSTALL_RESULT_COOKIE, JSON.stringify({ name: profile.name ?? tokens.locationId }), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/install",
      maxAge: 5 * 60,
    });
    return done;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error("oauth callback failed:", message);
    const reason = /location token/i.test(message) ? "agency_token" : /token request failed/i.test(message) ? "exchange" : "save";
    return NextResponse.redirect(new URL(`/install/error?reason=${reason}`, origin));
  }
}
