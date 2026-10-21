import { StatusChip } from "@/components/brand/StatusChip";
import { Wordmark } from "@/components/brand/Wordmark";

// Placeholder until Part E of the Phase 0 plan adds the HighLevel SSO handshake.
export default function EmbedPage() {
  return (
    <main className="page">
      <header className="row" style={{ justifyContent: "space-between" }}>
        <Wordmark />
        <StatusChip label="Onboarding not started" />
      </header>
      <section className="panel">
        <h2>Welcome to Command Center</h2>
        <p className="muted">
          This page will load inside your HighLevel account. Single sign-on is not
          wired up yet.
        </p>
      </section>
    </main>
  );
}
