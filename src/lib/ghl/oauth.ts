import { randomBytes, timingSafeEqual } from "node:crypto";
import { appUrl } from "@/lib/supabase/env";
import { GHL_API_BASE, GHL_API_VERSION, GHL_AUTHORIZE_URL, GHL_SCOPES, ghlEnv } from "./env";

export type LocationTokens = {
  kind: "location";
  accessToken: string;
  // Null when the token was minted from the agency token: it is re-minted, not refreshed.
  refreshToken: string | null;
  expiresInSeconds: number;
  scopes: string[];
  locationId: string;
  companyId: string | null;
  userId: string | null;
};

/**
 * What HighLevel returns when an agency admin installs and picks sub-accounts:
 * one company-level token plus the locations they approved. Location tokens are
 * minted from it with POST /oauth/locationToken.
 */
export type AgencyTokens = {
  kind: "agency";
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  scopes: string[];
  companyId: string;
  userId: string | null;
  approvedLocations: string[];
};

export type InstallTokens = LocationTokens | AgencyTokens;

export function callbackUrl(): string {
  return `${appUrl()}/api/oauth/callback`;
}

export function buildInstallUrl(input: {
  clientId: string;
  appId: string;
  redirectUri: string;
  state?: string;
}): string {
  const url = new URL(GHL_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("scope", GHL_SCOPES.join(" "));
  url.searchParams.set("version_id", input.appId);
  if (input.state) url.searchParams.set("state", input.state);
  return url.toString();
}

export function installUrl(state?: string): string {
  const { clientId, appId } = ghlEnv();
  return buildInstallUrl({ clientId, appId, redirectUri: callbackUrl(), state });
}

export const OAUTH_STATE_COOKIE = "oauth_state";

export function newOauthState(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * CSRF check for the callback. Installs started from our own install link carry
 * a state that must match the cookie we set. Installs started from HighLevel's
 * marketplace link carry no state and no cookie, and are allowed: the code is
 * single-use, the exchange needs the client secret, and only locations inside
 * Tom's agency can install a private "agency only" app.
 */
export function verifyOauthState(stateParam: string | null, stateCookie: string | null): "ok" | "marketplace" | "mismatch" {
  if (!stateParam && !stateCookie) return "marketplace";
  if (!stateParam || !stateCookie) return "mismatch";
  const a = Buffer.from(stateParam);
  const b = Buffer.from(stateCookie);
  return a.length === b.length && timingSafeEqual(a, b) ? "ok" : "mismatch";
}

function scopesFrom(data: Record<string, unknown>): string[] {
  return typeof data.scope === "string" ? data.scope.split(" ").filter(Boolean) : [];
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

/** Validates HighLevel's /oauth/token response: a sub-account token or an agency token. */
export function parseTokenResponse(raw: unknown): InstallTokens {
  if (!raw || typeof raw !== "object") throw new Error("Token response was not an object.");
  const data = raw as Record<string, unknown>;

  const accessToken = stringOrNull(data.access_token);
  const refreshToken = stringOrNull(data.refresh_token);
  const locationId = stringOrNull(data.locationId);
  const companyId = stringOrNull(data.companyId);
  const userId = stringOrNull(data.userId);
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : Number(data.expires_in);

  if (!accessToken) throw new Error("Token response had no access_token.");
  if (!refreshToken) throw new Error("Token response had no refresh_token.");
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) throw new Error("Token response had no usable expires_in.");

  if (locationId) {
    return {
      kind: "location",
      accessToken,
      refreshToken,
      expiresInSeconds: expiresIn,
      scopes: scopesFrom(data),
      locationId,
      companyId,
      userId,
    };
  }

  if (!companyId) throw new Error("Token had neither a locationId nor a companyId.");
  const approvedLocations = Array.isArray(data.approvedLocations)
    ? data.approvedLocations.filter((value): value is string => typeof value === "string" && value.length > 0)
    : [];
  return {
    kind: "agency",
    accessToken,
    refreshToken,
    expiresInSeconds: expiresIn,
    scopes: scopesFrom(data),
    companyId,
    userId,
    approvedLocations,
  };
}

/** Validates the /oauth/locationToken response. It carries no refresh token. */
export function parseLocationTokenResponse(raw: unknown, companyId: string): LocationTokens {
  if (!raw || typeof raw !== "object") throw new Error("Location token response was not an object.");
  const data = raw as Record<string, unknown>;
  const accessToken = stringOrNull(data.access_token);
  const locationId = stringOrNull(data.locationId);
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : Number(data.expires_in);

  if (!accessToken) throw new Error("Location token response had no access_token.");
  if (!locationId) throw new Error("Location token response had no locationId.");
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) throw new Error("Location token response had no usable expires_in.");

  return {
    kind: "location",
    accessToken,
    refreshToken: null,
    expiresInSeconds: expiresIn,
    scopes: scopesFrom(data),
    locationId,
    companyId,
    userId: stringOrNull(data.userId),
  };
}

async function postForm(path: string, form: Record<string, string>, headers: Record<string, string> = {}): Promise<unknown> {
  const response = await fetch(`${GHL_API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", ...headers },
    body: new URLSearchParams(form).toString(),
  });

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body && typeof body === "object" ? JSON.stringify(body).slice(0, 300) : response.statusText;
    throw new Error(`HighLevel token request failed (${response.status}) on ${path}: ${detail}`);
  }
  return body;
}

export async function exchangeCodeForTokens(code: string): Promise<InstallTokens> {
  const { clientId, clientSecret } = ghlEnv();
  return parseTokenResponse(
    await postForm("/oauth/token", {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      user_type: "Location",
      redirect_uri: callbackUrl(),
    }),
  );
}

export type TokenUserType = "Location" | "Company";

export async function refreshAccessToken(refreshToken: string, userType: TokenUserType = "Location"): Promise<InstallTokens> {
  const { clientId, clientSecret } = ghlEnv();
  return parseTokenResponse(
    await postForm("/oauth/token", {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      user_type: userType,
    }),
  );
}

/** Mints a sub-account token from the agency token. Needs the oauth.write scope. */
export async function mintLocationToken(agencyAccessToken: string, companyId: string, locationId: string): Promise<LocationTokens> {
  const body = await postForm(
    "/oauth/locationToken",
    { companyId, locationId },
    { Authorization: `Bearer ${agencyAccessToken}`, Version: GHL_API_VERSION },
  );
  return parseLocationTokenResponse(body, companyId);
}
