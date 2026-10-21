import Link from "next/link";
import { StatusChip } from "@/components/brand/StatusChip";
import { Wordmark } from "@/components/brand/Wordmark";

export default function HomePage() {
  return (
    <main className="page">
      <header className="row" style={{ justifyContent: "space-between" }}>
        <Wordmark />
        <StatusChip label="System operational" />
      </header>

      <section>
        <h1 style={{ fontSize: "clamp(2rem, 6vw, 3.5rem)" }}>Command Center</h1>
        <p className="muted" style={{ marginTop: "var(--space-4)", maxWidth: "var(--measure)" }}>
          One home for every client. Onboarding, voice, and the generators that turn
          client data into finished assets.
        </p>
      </section>

      <section className="panel">
        <span className="mono muted">Phase 0: Foundation</span>
        <p>
          The app shell is up. Admin login and the HighLevel embed are the next two steps.
        </p>
        <div className="row">
          <Link className="button" href="/admin">
            Admin
          </Link>
          <Link className="button button-ghost" href="/embed">
            Client view (HighLevel embed)
          </Link>
        </div>
      </section>
    </main>
  );
}
