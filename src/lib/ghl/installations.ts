import { createSecretSupabase } from "@/lib/supabase/server";
import { ghlEnv } from "./env";
import { refreshAccessToken, type LocationTokens } from "./oauth";
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
        refresh_token_encrypted: encryptToken(tokens.refreshToken, tokenEncryptionKey),
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
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: string;
  uninstalled_at: string | null;
};

/**
 * The access token for a location, refreshed if it is about to expire.
 * `force` refreshes regardless, used after a 401.
 */
export async function getLocationAccessToken(locationId: string, options: { force?: boolean } = {}): Promise<string> {
  const supabase = createSecretSupabase();
  const { tokenEncryptionKey } = ghlEnv();

  const { data, error } = await supabase
    .from("ghl_installations")
    .select("id, access_token_encrypted, refresh_token_encrypted, token_expires_at, uninstalled_at")
    .eq("ghl_location_id", locationId)
    .maybeSingle();
  if (error) throw new Error(`Could not load installation: ${error.message}`);
  if (!data) throw new Error(`No installation for location ${locationId}.`);
  const stored = data as StoredInstallation;
  if (stored.uninstalled_at) throw new Error(`The app was uninstalled from location ${locationId}.`);

  const expiresSoon = new Date(stored.token_expires_at).getTime() - Date.now() < REFRESH_WINDOW_MS;
  if (!options.force && !expiresSoon) {
    return decryptToken(stored.access_token_encrypted, tokenEncryptionKey);
  }

  try {
    const fresh = await refreshAccessToken(decryptToken(stored.refresh_token_encrypted, tokenEncryptionKey));
    const { error: updateError } = await supabase
      .from("ghl_installations")
      .update({
        access_token_encrypted: encryptToken(fresh.accessToken, tokenEncryptionKey),
        refresh_token_encrypted: encryptToken(fresh.refreshToken, tokenEncryptionKey),
        token_expires_at: expiresAtFrom(fresh.expiresInSeconds),
        scopes: fresh.scopes,
        last_refreshed_at: new Date().toISOString(),
        last_refresh_error: null,
      })
      .eq("id", stored.id);
    if (updateError) throw new Error(`Refreshed but could not store the new token: ${updateError.message}`);
    return fresh.accessToken;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    await supabase.from("ghl_installations").update({ last_refresh_error: message }).eq("id", stored.id);
    throw cause;
  }
}
