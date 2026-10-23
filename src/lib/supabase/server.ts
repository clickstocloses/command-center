import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { publicSupabaseEnv, secretSupabaseKey } from "./env";

if (typeof window !== "undefined") {
  throw new Error("src/lib/supabase/server.ts is server-only. Never import it from a client component.");
}

/**
 * Acts as the signed-in user. Row-level security applies.
 * Session lives in cookies (the admin app is a normal site, not the iframe).
 */
export async function createUserSupabase(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const { url, publishableKey } = publicSupabaseEnv();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components can't write cookies. The proxy refreshes sessions
          // on every request, so dropping the write here loses nothing.
        }
      },
    },
  });
}

/**
 * Acts as the server. Bypasses row-level security.
 * Only for things the user must not be able to do themselves:
 * creating auth users for staff rows, writing audit and usage rows, token storage.
 */
export function createSecretSupabase(): SupabaseClient {
  const { url } = publicSupabaseEnv();
  return createClient(url, secretSupabaseKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
