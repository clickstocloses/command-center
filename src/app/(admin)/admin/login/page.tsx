import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand/Wordmark";
import { getCurrentUser } from "@/lib/auth/staff";
import { LoginForm } from "./LoginForm";
import { signOutAction } from "./actions";

export default function LoginPage() {
  return (
    <main className="page" style={{ maxWidth: "28rem" }}>
      <Wordmark />
      <section className="panel">
        <span className="mono muted">Admin</span>
        <h2>Sign in</h2>
        <Suspense fallback={<p className="muted">One moment</p>}>
          <LoginGate />
        </Suspense>
      </section>
    </main>
  );
}

// Reads the session, so it lives inside Suspense (cache components is on).
async function LoginGate() {
  const current = await getCurrentUser();

  if (current.kind === "staff") redirect("/admin");

  if (current.kind === "not_staff") {
    return (
      <>
        <p className="notice notice-error">
          {current.email ?? "This account"} isn&apos;t on the team list. Ask Tom to add you.
        </p>
        <form action={signOutAction}>
          <button className="button button-ghost" type="submit">
            Sign out
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      <p className="muted">Enter your email and we&apos;ll send a one-time code. No password.</p>
      <LoginForm />
    </>
  );
}
