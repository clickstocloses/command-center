import { redirect } from "next/navigation";
import { createUserSupabase } from "@/lib/supabase/server";
import type { StaffRole } from "./permissions";

export type Staff = {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  permissions: Record<string, unknown>;
  active: boolean;
  auth_user_id: string | null;
};

type CurrentUser =
  | { kind: "anonymous" }
  | { kind: "not_staff"; email: string | null }
  | { kind: "staff"; staff: Staff };

/**
 * Who is making this request. The staff row is read as the signed-in user, so
 * RLS decides: a signed-in person with no active staff row gets nothing back.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const supabase = await createUserSupabase();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return { kind: "anonymous" };

  const { data: staff } = await supabase
    .from("staff")
    .select("id, email, name, role, permissions, active, auth_user_id")
    .eq("auth_user_id", claims.sub)
    .maybeSingle();

  if (!staff) return { kind: "not_staff", email: typeof claims.email === "string" ? claims.email : null };
  return { kind: "staff", staff: staff as Staff };
}

/** For protected pages. Sends anyone who isn't staff to the login page. */
export async function requireStaff(): Promise<Staff> {
  const current = await getCurrentUser();
  if (current.kind !== "staff") redirect("/admin/login");
  return current.staff;
}
