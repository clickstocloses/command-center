import { Suspense } from "react";
import Link from "next/link";
import { StatusChip } from "@/components/brand/StatusChip";
import { Wordmark } from "@/components/brand/Wordmark";
import { createSecretSupabase } from "@/lib/supabase/server";

type SearchParams = Promise<{ location?: string }>;

export default function InstallDonePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="page" style={{ maxWidth: "32rem" }}>
      <header className="row" style={{ justifyContent: "space-between" }}>
        <Wordmark />
        <StatusChip label="Installed" />
      </header>
      <section className="panel">
        <h2>Command Center is installed</h2>
        <Suspense fallback={<p className="muted">Checking the account</p>}>
          <InstalledLocation searchParams={searchParams} />
        </Suspense>
        <p className="muted">
          The client now shows on the admin dashboard, and the Command Center menu item appears in their
          sub-account.
        </p>
        <Link className="button" href="/admin">
          Open the admin
        </Link>
      </section>
    </main>
  );
}

// Reads the client name with the server key so this page works without a login.
// Only the name is shown, and only for a location that was just installed.
async function InstalledLocation({ searchParams }: { searchParams: SearchParams }) {
  const { location } = await searchParams;
  if (!location) return null;

  const { data } = await createSecretSupabase()
    .from("clients")
    .select("name")
    .eq("ghl_location_id", location)
    .maybeSingle();

  return (
    <p>
      Sub-account: <strong>{data?.name ?? location}</strong>
    </p>
  );
}
