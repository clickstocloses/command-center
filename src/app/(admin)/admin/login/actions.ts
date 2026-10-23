"use server";

import { redirect } from "next/navigation";
import { CODE_SENT_MESSAGE, requestLoginCode, verifyLoginCode } from "@/lib/auth/login";
import { createUserSupabase } from "@/lib/supabase/server";
import { initialLoginState, type LoginFormState } from "./state";

export async function requestCodeAction(_previous: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const email = String(formData.get("email") ?? "");
  const result = await requestLoginCode(email);
  if (!result.ok) return { step: "email", email, message: result.message, isError: true };
  return { step: "code", email: email.trim().toLowerCase(), message: CODE_SENT_MESSAGE, isError: false };
}

export async function verifyCodeAction(previous: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const email = String(formData.get("email") ?? previous.email);
  const code = String(formData.get("code") ?? "");
  const result = await verifyLoginCode(email, code);
  if (!result.ok) return { step: "code", email, message: result.message, isError: true };
  redirect("/admin");
}

export async function startOverAction(): Promise<LoginFormState> {
  return initialLoginState;
}

export async function signOutAction(): Promise<void> {
  const supabase = await createUserSupabase();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
