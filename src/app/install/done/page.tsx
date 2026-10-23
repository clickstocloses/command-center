import { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { StatusChip } from "@/components/brand/StatusChip";
import { Wordmark } from "@/components/brand/Wordmark";

export default function InstallDonePage() {
  return (
    <main className="page" style={{ maxWidth: "32rem" }}>
      <header className="row" style={{ justifyContent: "space-between" }}>
        <Wordmark />
        <StatusChip label="Installed" />
      </header>
      <section className="panel">
        <h2>Command Center is installed</h2>
        <Suspense fallback={null}>
          <InstalledName />
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

// The callback leaves the name in a short-lived cookie. No database lookup from
// anything the browser can type into a URL.
async function InstalledName() {
  const raw = (await cookies()).get("install_result")?.value;
  if (!raw) return null;
  try {
    const { name } = JSON.parse(raw) as { name?: string };
    return name ? (
      <p>
        Sub-account: <strong>{name}</strong>
      </p>
    ) : null;
  } catch {
    return null;
  }
}
