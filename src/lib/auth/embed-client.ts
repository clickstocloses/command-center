import { createSecretSupabase } from "@/lib/supabase/server";
import type { SsoUser } from "@/lib/ghl/sso";

export type EmbedClient = { id: string; name: string; status: string };

export type ResolveResult =
  | { ok: true; client: EmbedClient; isStaff: boolean }
  | { ok: false; reason: "no_location" | "not_installed" | "inactive" };

const INACTIVE_STATUSES = new Set(["paused", "churned"]);

/**
 * The three checks from PRD 4.1, Phase 0 version: the location has the app
 * installed, the client isn't paused or closed, and the user is recorded as
 * one of that client's users. The SaaS subscription check comes later.
 */
export async function resolveEmbedClient(user: SsoUser): Promise<ResolveResult> {
  if (!user.activeLocation) return { ok: false, reason: "no_location" };
  const supabase = createSecretSupabase();

  const { data: client, error } = await supabase
    .from("clients")
    .select("id, name, status, ghl_installations!inner(uninstalled_at)")
    .eq("ghl_location_id", user.activeLocation)
    .maybeSingle();
  if (error) throw new Error(`Could not look up the client: ${error.message}`);
  const installation = client?.ghl_installations as
    | { uninstalled_at: string | null }[]
    | { uninstalled_at: string | null }
    | undefined;
  const uninstalledAt = Array.isArray(installation) ? installation[0]?.uninstalled_at : installation?.uninstalled_at;
  if (!client || uninstalledAt) return { ok: false, reason: "not_installed" };
  if (INACTIVE_STATUSES.has(client.status)) return { ok: false, reason: "inactive" };

  const { error: userError } = await supabase.from("client_users").upsert(
    {
      client_id: client.id,
      ghl_user_id: user.userId,
      name: user.userName,
      email: user.email,
      role: user.role,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "client_id,ghl_user_id" },
  );
  if (userError) throw new Error(`Could not record the client user: ${userError.message}`);

  let isStaff = false;
  if (user.email) {
    const { data: staff } = await supabase
      .from("staff")
      .select("id")
      .eq("email", user.email.trim().toLowerCase())
      .eq("active", true)
      .maybeSingle();
    isStaff = Boolean(staff);
  }

  return { ok: true, client: { id: client.id, name: client.name, status: client.status }, isStaff };
}
