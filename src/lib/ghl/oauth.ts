import { appUrl } from "@/lib/supabase/env";
import { GHL_API_BASE, GHL_AUTHORIZE_URL, GHL_SCOPES, ghlEnv } from "./env";

export type LocationTokens = {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  scopes: string[];
  locationId: string;
  companyId: string | null;
  userId: string | null;
};

export function callbackUrl(): string {
  return `${appUrl()}/api/oauth/callback`;
}

export function buildInstallUrl(input: { clientId: string; appId: string; redirectUri: string }): string {
  const url = new URL(GHL_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("scope", GHL_SCOPES.join(" "));
  url.searchParams.set("version_id", input.appId);
  return url.toString();
}

export function installUrl(): string {
  const { clientId, appId } = ghlEnv();
  return buildInstallUrl({ clientId, appId, redirectUri: callbackUrl() });
}

/** Validates HighLevel's /oauth/token response. We only ever want location tokens. */
export function parseTokenResponse(raw: unknown): LocationTokens {
  if (!raw || typeof raw !== "object") throw new Error("Token response was not an object.");
  const data = raw as Record<string, unknown>;

  const accessToken = typeof data.access_token === "string" ? data.access_token : null;
  const refreshToken = typeof data.refresh_token === "string" ? data.refresh_token : null;
  const locationId = typeof data.locationId === "string" ? data.locationId : null;
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : Number(data.expires_in);

  if (!accessToken) throw new Error("Token response had no access_token.");
  if (!refreshToken) throw new Error("Token response had no refresh_token.");
  if (!locationId) throw new Error("Token is not a location token. Install the app on a sub-account, not the agency.");
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) throw new Error("Token response had no usable expires_in.");

  return {
    accessToken,
    refreshToken,
    expiresInSeconds: expiresIn,
    scopes: typeof data.scope === "string" ? data.scope.split(" ").filter(Boolean) : [],
    locationId,
    companyId: typeof data.companyId === "string" ? data.companyId : null,
    userId: typeof data.userId === "string" ? data.userId : null,
  };
}

async function postTokenRequest(form: Record<string, string>): Promise<LocationTokens> {
  const response = await fetch(`${GHL_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(form).toString(),
  });

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body && typeof body === "object" ? JSON.stringify(body).slice(0, 300) : response.statusText;
    throw new Error(`HighLevel token request failed (${response.status}): ${detail}`);
  }
  return parseTokenResponse(body);
}

export async function exchangeCodeForTokens(code: string): Promise<LocationTokens> {
  const { clientId, clientSecret } = ghlEnv();
  return postTokenRequest({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    user_type: "Location",
    redirect_uri: callbackUrl(),
  });
}

export async function refreshAccessToken(refreshToken: string): Promise<LocationTokens> {
  const { clientId, clientSecret } = ghlEnv();
  return postTokenRequest({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    user_type: "Location",
  });
}
