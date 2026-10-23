export const GHL_API_BASE = "https://services.leadconnectorhq.com";
export const GHL_API_VERSION = "2021-07-28";
export const GHL_AUTHORIZE_URL = "https://marketplace.gohighlevel.com/v2/oauth/chooselocation";

// Must match what the Marketplace app was configured with. Changing it means every location reinstalls.
export const GHL_SCOPES = [
  "locations.readonly",
  "locations/customValues.readonly",
  "locations/customValues.write",
  "users.readonly",
  "calendars.readonly",
  "calendars/events.readonly",
  "contacts.readonly",
  "conversations.readonly",
  "conversations/message.readonly",
  "locations/customFields.readonly",
  "locations/customFields.write",
  "saas/location.read",
  "oauth.readonly",
] as const;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}. See .env.example.`);
  return value;
}

export type GhlEnv = {
  appId: string;
  clientId: string;
  clientSecret: string;
  sharedSecret: string;
  tokenEncryptionKey: Buffer;
};

export function ghlEnv(): GhlEnv {
  const tokenEncryptionKey = Buffer.from(required("GHL_TOKEN_ENCRYPTION_KEY"), "base64");
  if (tokenEncryptionKey.length !== 32) {
    throw new Error("GHL_TOKEN_ENCRYPTION_KEY must be 32 random bytes, base64 encoded.");
  }
  return {
    appId: required("GHL_APP_ID"),
    clientId: required("GHL_CLIENT_ID"),
    clientSecret: required("GHL_CLIENT_SECRET"),
    sharedSecret: required("GHL_SHARED_SECRET"),
    tokenEncryptionKey,
  };
}
