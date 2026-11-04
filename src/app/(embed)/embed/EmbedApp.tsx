"use client";

import { useEffect, useState } from "react";
import { StatusChip } from "@/components/brand/StatusChip";
import { Wordmark } from "@/components/brand/Wordmark";
import { requestUserData } from "@/lib/embed/handshake";
import type { EmbedSessionResponse } from "@/app/api/embed/session/route";

type State =
  | { kind: "connecting" }
  | { kind: "ready"; session: EmbedSessionResponse }
  | { kind: "error"; code: string };

const ERROR_COPY: Record<string, string> = {
  not_in_iframe: "Open Command Center from the menu inside your HighLevel account.",
  timeout: "HighLevel didn't answer. Refresh the page, or open Command Center from the menu again.",
  not_installed: "Command Center isn't set up on this account yet. Contact Clicks to Closes.",
  inactive: "Your account isn't active. Contact Clicks to Closes.",
  no_location: "Open Command Center from inside a sub-account, not the agency view.",
  bad_payload: "We couldn't verify your HighLevel session. Refresh and try again.",
};

export function EmbedApp() {
  // The token lives only here. No cookie, no storage: Safari blocks both inside the iframe.
  const [state, setState] = useState<State>({ kind: "connecting" });

  useEffect(() => {
    let cancelled = false;
    async function connect() {
      try {
        const payload = await requestUserData();
        const response = await fetch("/api/embed/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload }),
        });
        const body = (await response.json()) as EmbedSessionResponse | { error: string };
        if (cancelled) return;
        if (!response.ok || "error" in body) {
          setState({ kind: "error", code: "error" in body ? body.error : "bad_payload" });
          return;
        }
        setState({ kind: "ready", session: body });
      } catch (cause) {
        if (!cancelled) setState({ kind: "error", code: cause instanceof Error ? cause.message : "timeout" });
      }
    }
    void connect();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "connecting") {
    return (
      <main className="page">
        <header className="row" style={{ justifyContent: "space-between" }}>
          <Wordmark />
          <StatusChip label="Connecting" />
        </header>
      </main>
    );
  }

  if (state.kind === "error") {
    return (
      <main className="page">
        <header className="row" style={{ justifyContent: "space-between" }}>
          <Wordmark />
          <StatusChip label="Not connected" />
        </header>
        <section className="panel">
          <h2>We couldn&apos;t open Command Center</h2>
          <p className="notice notice-error">{ERROR_COPY[state.code] ?? ERROR_COPY.bad_payload}</p>
        </section>
      </main>
    );
  }

  const { client, user } = state.session;
  return (
    <main className="page">
      <header className="row" style={{ justifyContent: "space-between" }}>
        <Wordmark />
        <StatusChip label={client.statusLabel} />
      </header>
      <section className="panel">
        <h2>Welcome{user.name ? `, ${user.name.split(" ")[0]}` : ""}</h2>
        <p>
          This is Command Center for <strong>{client.name}</strong>.
        </p>
        <p className="muted">
          Your onboarding hasn&apos;t started yet. When it opens, this is where you&apos;ll answer the setup
          questions, record your voice profile and see everything we build for you.
        </p>
        {user.isStaff ? <p className="mono muted">Staff view</p> : null}
      </section>
    </main>
  );
}
