import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

/**
 * Talks to the LOCAL Supabase stack only (npx supabase start).
 * Keys come from `supabase status`, never from .env.local, so these tests
 * can't accidentally hit the cloud project.
 */

type LocalStack = {
  apiUrl: string;
  publishableKey: string;
  secretKey: string;
  jwtSecret: string;
};

let cachedStack: LocalStack | undefined;

export function getLocalStack(): LocalStack {
  if (cachedStack) return cachedStack;

  const raw = execFileSync("npx", ["supabase", "status", "-o", "env"], { encoding: "utf8" });
  const values = new Map<string, string>();
  for (const line of raw.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (match) values.set(match[1], match[2]);
  }

  const required = ["API_URL", "PUBLISHABLE_KEY", "SECRET_KEY", "JWT_SECRET"] as const;
  for (const key of required) {
    if (!values.get(key)) throw new Error(`supabase status did not return ${key}. Is the local stack running?`);
  }

  cachedStack = {
    apiUrl: values.get("API_URL")!,
    publishableKey: values.get("PUBLISHABLE_KEY")!,
    secretKey: values.get("SECRET_KEY")!,
    jwtSecret: values.get("JWT_SECRET")!,
  };
  return cachedStack;
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/** Signs a JWT the way the local GoTrue would, so PostgREST accepts it. */
export function mintJwt(claims: Record<string, unknown>): string {
  const { jwtSecret } = getLocalStack();
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = base64Url(
    JSON.stringify({
      iss: "supabase-demo",
      aud: "authenticated",
      role: "authenticated",
      iat: nowSeconds,
      exp: nowSeconds + 60 * 10,
      ...claims,
    }),
  );
  const signature = createHmac("sha256", jwtSecret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function clientWithJwt(jwt: string): SupabaseClient {
  const { apiUrl, publishableKey } = getLocalStack();
  return createClient(apiUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

/** The server. Bypasses RLS. Use for setup, cleanup and asserting ground truth. */
export function asSecret(): SupabaseClient {
  const { apiUrl, secretKey } = getLocalStack();
  return createClient(apiUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** A visitor with no session. Only the publishable key. */
export function asAnonymous(): SupabaseClient {
  const { apiUrl, publishableKey } = getLocalStack();
  return createClient(apiUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * A signed-in staff member. Creates the auth user on first use and links it
 * to the seeded staff row by email, the same thing Part C does on first OTP login.
 */
export async function asStaff(email: string): Promise<SupabaseClient> {
  const secret = asSecret();

  const { data: staffRow, error: staffError } = await secret
    .from("staff")
    .select("id, auth_user_id")
    .eq("email", email)
    .single();
  if (staffError || !staffRow) throw new Error(`No seeded staff row for ${email}: ${staffError?.message}`);

  let authUserId: string | null = staffRow.auth_user_id;
  if (!authUserId) {
    const { data: created, error: createError } = await secret.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (createError || !created.user) throw new Error(`Could not create auth user: ${createError?.message}`);
    authUserId = created.user.id;

    const { error: linkError } = await secret.from("staff").update({ auth_user_id: authUserId }).eq("id", staffRow.id);
    if (linkError) throw new Error(`Could not link staff row: ${linkError.message}`);
  }

  return clientWithJwt(mintJwt({ sub: authUserId, email }));
}

/** A client session scoped to one client, as Part E will mint after SSO. */
export function asClient(clientId: string): SupabaseClient {
  return clientWithJwt(mintJwt({ sub: randomUUID(), client_id: clientId }));
}

export async function seededClientId(ghlLocationId: string): Promise<string> {
  const { data, error } = await asSecret().from("clients").select("id").eq("ghl_location_id", ghlLocationId).single();
  if (error || !data) throw new Error(`Seeded client ${ghlLocationId} missing: ${error?.message}`);
  return data.id;
}

export const OWNER_EMAIL = "tom@clickstocloses.com";
export const TEAM_EMAIL = "team@example.com";
export const NORTHSIDE = "loc_fake_northside";
export const BRIGHTLINE = "loc_fake_brightline";
