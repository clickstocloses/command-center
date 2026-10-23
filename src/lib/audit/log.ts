import { createSecretSupabase } from "@/lib/supabase/server";

export type AuditEntry = {
  actorType: "staff" | "client_user" | "system";
  actorId?: string | null;
  clientId?: string | null;
  action: string;
  targetTable?: string | null;
  targetId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

/**
 * Append a row to audit_log. Never throws: an audit failure must not break
 * the action it describes, but it is logged loudly so it gets noticed.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  const { error } = await createSecretSupabase().from("audit_log").insert({
    actor_type: entry.actorType,
    actor_id: entry.actorId ?? null,
    client_id: entry.clientId ?? null,
    action: entry.action,
    target_table: entry.targetTable ?? null,
    target_id: entry.targetId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
  if (error) console.error("audit_log write failed", entry.action, error.message);
}
