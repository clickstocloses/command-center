import { createSecretSupabase } from "@/lib/supabase/server";
import { ghlEnv } from "./env";
import { mintLocationToken, refreshAccessToken, type AgencyTokens, type LocationTokens } from "./oauth";
import { decryptToken, encryptToken } from "./token-crypto";

// Refresh a little early so a request never goes out with a token about to die.
const EXPIRY_SKEW_MS = 60_000;
const REFRESH_WINDOW_MS = 5 * 60_000;

export type LocationProfile = {
  name: string | null;
  timezone: string | null;
  website: string | null;
  companyId: string | null;
};

export type SavedInstallation = {
  clientId: string;
  installationId: string;
  isNewClient: boolean;
};

function expiresAtFrom(expiresInSeconds: number): string {
  return new Date(Date.now() + expiresInSeconds * 1000 - EXPIRY_SKEW_MS).toISOString();
}

function expiresSoon(tokenExpiresAt: string): boolean {
  return new Date(tokenExpiresAt).getTime() - Date.now() < REFRESH_WINDOW_MS;
}

/** Stores the agency token an agency-level install returns. One row per HighLevel company. */
export async function saveAgencyTokens(tokens: AgencyTokens): Promise<void> {
  const supabase = createSecretSupabase();
  const { tokenEncryptionKey } = ghlEnv();

  const { error } = await supabase.from("ghl_agency_tokens").upsert(
    {
      ghl_company_id: tokens.companyId,
      ghl_user_id: tokens.userId,
      access_token_encrypted: encryptToken(tokens.accessToken, tokenEncryptionKey),
      refresh_token_encrypted: encryptToken(tokens.refreshToken, tokenEncryptionKey),
      token_expires_at: expiresAtFrom(tokens.expiresInSeconds),
      scopes: tokens.scopes,
      installed_at: new Date().toISOString(),
      last_refreshed_at: null,
      last_refresh_error: null,
    },
    { onConflict: "ghl_company_id" },
  );
  if (error) throw new Error(`Could not save agency tokens: ${error.message}`);
}

type StoredAgencyTokens = {
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: string;
};

/** The agency access token for a company, refreshed if it is about to expire. */
export async function getAgencyAccessToken(companyId: string): Promise<string> {
  const supabase = createSecretSupabase();
  const { tokenEncryptionKey } = ghlEnv();

  const { data, error } = await supabase
    .from("ghl_agency_tokens")
    .select("access_token_encrypted, refresh_token_encrypted, token_expires_at")
    .eq("ghl_company_id", companyId)
    .maybeSingle();
  if (error) throw new Error(`Could not load agency tokens: ${error.message}`);
  if (!data) throw new Error(`No agency tokens for company ${companyId}. Reinstall the app from the agency.`);
  const stored = data as StoredAgencyTokens;

  if (!expiresSoon(stored.token_expires_at)) {
    return decryptToken(stored.access_token_encrypted, tokenEncryptionKey);
  }

  try {
    const fresh = await refreshAccessToken(decryptToken(stored.refresh_token_encrypted, tokenEncryptionKey), "Company");
    if (fresh.kind !== "agency") throw new Error("Refreshing the agency token returned a location token.");
    const { error: updateError } = await supabase
      .from("ghl_agency_tokens")
      .update({
        access_token_encrypted: encryptToken(fresh.accessToken, tokenEncryptionKey),
        refresh_token_encrypted: encryptToken(fresh.refreshToken, tokenEncryptionKey),
        token_expires_at: expiresAtFrom(fresh.expiresInSeconds),
        scopes: fresh.scopes,
        last_refreshed_at: new Date().toISOString(),
        last_refresh_error: null,
      })
      .eq("ghl_company_id", companyId);
    if (updateError) throw new Error(`Refreshed but could not store the new agency token: ${updateError.message}`);
    return fresh.accessToken;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    await supabase.from("ghl_agency_tokens").update({ last_refresh_error: message }).eq("ghl_company_id", companyId);
    throw cause;
  }
}

/** Creates or updates the client and stores the encrypted tokens. Server only. */
export async function saveInstallation(tokens: LocationTokens, profile: LocationProfile): Promise<SavedInstallation> {
  const supabase = createSecretSupabase();
  const { tokenEncryptionKey } = ghlEnv();

  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("ghl_location_id", tokens.locationId)
    .maybeSingle();

  const clientFields = {
    ghl_location_id: tokens.locationId,
    ghl_company_id: profile.companyId ?? tokens.companyId,
    name: profile.name ?? `Location ${tokens.locationId}`,
    timezone: profile.timezone,
    website_url: profile.website,
  };

  const { data: client, error: clientError } = existing
    ? await supabase.from("clients").update(clientFields).eq("id", existing.id).select("id").single()
    : await supabase.from("clients").insert(clientFields).select("id").single();
  if (clientError || !client) throw new Error(`Could not save client: ${clientError?.message}`);

  const { data: installation, error: installError } = await supabase
    .from("ghl_installations")
    .upsert(
      {
        client_id: client.id,
        ghl_location_id: tokens.locationId,
        ghl_company_id: tokens.companyId,
        ghl_user_id: tokens.userId,
        access_token_encrypted: encryptToken(tokens.accessToken, tokenEncryptionKey),
        refresh_token_encrypted: tokens.refreshToken ? encryptToken(tokens.refreshToken, tokenEncryptionKey) : null,
        token_source: tokens.refreshToken ? "location" : "agency",
        token_expires_at: expiresAtFrom(tokens.expiresInSeconds),
        scopes: tokens.scopes,
        installed_at: new Date().toISOString(),
        uninstalled_at: null,
        last_refreshed_at: null,
        last_refresh_error: null,
      },
      { onConflict: "ghl_location_id" },
    )
    .select("id")
    .single();
  if (installError || !installation) throw new Error(`Could not save installation: ${installError?.message}`);

  return { clientId: client.id, installationId: installation.id, isNewClient: !existing };
}

type StoredInstallation = {
  id: string;
  ghl_company_id: string | null;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  token_source: "location" | "agency";
  token_expires_at: string;
  uninstalled_at: string | null;
};

/**
 * The access token for a location, renewed if it is about to expire.
 * A directly installed location refreshes with its own refresh token. A location
 * installed from the agency has none, so a new token is minted from the agency token.
 * `force` renews regardless, used after a 401.
 */
export async function getLocationAccessToken(locationId: string, options: { force?: boolean } = {}): Promise<string> {
  const supabase = createSecretSupabase();
  const { tokenEncryptionKey } = ghlEnv();

  const { data, error } = await supabase
    .from("ghl_installations")
    .select("id, ghl_company_id, access_token_encrypted, refresh_token_encrypted, token_source, token_expires_at, uninstalled_at")
    .eq("ghl_location_id", locationId)
    .maybeSingle();
  if (error) throw new Error(`Could not load installation: ${error.message}`);
  if (!data) throw new Error(`No installation for location ${locationId}.`);
  const stored = data as StoredInstallation;
  if (stored.uninstalled_at) throw new Error(`The app was uninstalled from location ${locationId}.`);

  if (!options.force && !expiresSoon(stored.token_expires_at)) {
    return decryptToken(stored.access_token_encrypted, tokenEncryptionKey);
  }

  try {
    const fresh = await renewLocationToken(stored, locationId, tokenEncryptionKey);
    const { error: updateError } = await supabase
      .from("ghl_installations")
      .update({
        access_token_encrypted: encryptToken(fresh.accessToken, tokenEncryptionKey),
        refresh_token_encrypted: fresh.refreshToken ? encryptToken(fresh.refreshToken, tokenEncryptionKey) : null,
        token_expires_at: expiresAtFrom(fresh.expiresInSeconds),
        scopes: fresh.scopes,
        last_refreshed_at: new Date().toISOString(),
        last_refresh_error: null,
      })
      .eq("id", stored.id);
    if (updateError) throw new Error(`Renewed but could not store the new token: ${updateError.message}`);
    return fresh.accessToken;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    await supabase.from("ghl_installations").update({ last_refresh_error: message }).eq("id", stored.id);
    throw cause;
  }
}

async function renewLocationToken(stored: StoredInstallation, locationId: string, key: Buffer): Promise<LocationTokens> {
  if (stored.token_source === "location" && stored.refresh_token_encrypted) {
    const fresh = await refreshAccessToken(decryptToken(stored.refresh_token_encrypted, key), "Location");
    if (fresh.kind !== "location") throw new Error("Refreshing a location token returned an agency token.");
    return fresh;
  }
  if (!stored.ghl_company_id) {
    throw new Error(`Location ${locationId} has no refresh token and no company id, so its token cannot be renewed.`);
  }
  return mintLocationToken(await getAgencyAccessToken(stored.ghl_company_id), stored.ghl_company_id, locationId);
}
