import { writeAuditLog } from "@/lib/audit/log";
import { appUrl } from "@/lib/supabase/env";
import { createSecretSupabase, createUserSupabase } from "@/lib/supabase/server";

export type LoginResult = { ok: true } | { ok: false; message: string };

// Whether or not the email is on the staff list, the user sees this. Never leak who is staff.
export const CODE_SENT_MESSAGE = "If that email is on the team list, a code is on its way.";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  if (!email || !EMAIL_SHAPE.test(email)) return null;
  return email;
}

/**
 * Sends a one-time code if, and only if, the email belongs to an active staff row.
 * Signups are disabled in Supabase Auth, so the server creates the auth user
 * for a staff row the first time and links it. Nobody else can get a code.
 */
export async function requestLoginCode(emailInput: string): Promise<LoginResult> {
  const email = normalizeEmail(emailInput);
  if (!email) return { ok: false, message: "Enter a valid email address." };

  const secret = createSecretSupabase();
  const { data: staff, error: staffError } = await secret
    .from("staff")
    .select("id, auth_user_id")
    .eq("email", email)
    .eq("active", true)
    .maybeSingle();

  if (staffError) {
    console.error("requestLoginCode: staff lookup failed", staffError.message);
    return { ok: false, message: "Something went wrong on our side. Try again in a minute." };
  }

  // Not staff: say the same thing, send nothing.
  if (!staff) return { ok: true };

  if (!staff.auth_user_id) {
    const authUserId = await ensureAuthUser(email);
    if (!authUserId) return { ok: false, message: "Something went wrong on our side. Try again in a minute." };
    await secret.from("staff").update({ auth_user_id: authUserId }).eq("id", staff.id);
  }

  const user = await createUserSupabase();
  const { error: otpError } = await user.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${appUrl()}/admin/auth/confirm`,
    },
  });

  if (otpError) {
    console.error("requestLoginCode: signInWithOtp failed", otpError.message);
    return { ok: false, message: "Couldn't send the code. Try again in a minute." };
  }

  return { ok: true };
}

/** Creates the Supabase Auth user for a staff email, or finds it if it already exists. */
async function ensureAuthUser(email: string): Promise<string | null> {
  const secret = createSecretSupabase();
  const { data: created, error } = await secret.auth.admin.createUser({ email, email_confirm: true });
  if (!error && created.user) return created.user.id;

  if (error?.code !== "email_exists") {
    console.error("ensureAuthUser: createUser failed", error?.message);
    return null;
  }

  // The auth user exists but was never linked. Find it by email.
  const { data: page, error: listError } = await secret.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) {
    console.error("ensureAuthUser: listUsers failed", listError.message);
    return null;
  }
  return page.users.find((user) => user.email?.toLowerCase() === email)?.id ?? null;
}

/** Exchanges the 6-digit code for a session. Cookies are written by the server action that calls this. */
export async function verifyLoginCode(emailInput: string, codeInput: string): Promise<LoginResult> {
  const email = normalizeEmail(emailInput);
  const code = codeInput.replace(/\D/g, "");
  if (!email || code.length < 6) return { ok: false, message: "Enter the 6-digit code from the email." };

  const user = await createUserSupabase();
  const { data, error } = await user.auth.verifyOtp({ email, token: code, type: "email" });

  if (error || !data.user) {
    return { ok: false, message: "That code didn't work. Check it, or request a new one." };
  }

  await writeAuditLog({
    actorType: "staff",
    actorId: data.user.id,
    action: "staff.login",
    after: { email, method: "otp_code" },
  });

  return { ok: true };
}
