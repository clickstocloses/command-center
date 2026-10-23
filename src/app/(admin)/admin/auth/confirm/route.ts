import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { writeAuditLog } from "@/lib/audit/log";
import { createUserSupabase } from "@/lib/supabase/server";

/**
 * Handles the "click here to sign in" link from the email. The code path is
 * the primary one; this exists so the link in the same email also works.
 */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;

  const loginUrl = new URL("/admin/login", request.nextUrl.origin);
  if (!tokenHash || !type) return NextResponse.redirect(loginUrl);

  const supabase = await createUserSupabase();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error || !data.user) return NextResponse.redirect(loginUrl);

  await writeAuditLog({
    actorType: "staff",
    actorId: data.user.id,
    action: "staff.login",
    after: { email: data.user.email, method: "email_link" },
  });

  return NextResponse.redirect(new URL("/admin", request.nextUrl.origin));
}
