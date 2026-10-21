import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";

// Placeholder until Part C of the Phase 0 plan adds OTP login.
export default function AdminPage() {
  return (
    <main className="page">
      <Wordmark />
      <section className="panel">
        <span className="mono muted">Admin</span>
        <h2>Login is next</h2>
        <p className="muted">
          Staff will sign in here with email and a one-time code. Not built yet.
        </p>
        <Link href="/">Back</Link>
      </section>
    </main>
  );
}
