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
          Each client now shows on the admin dashboard, and the Command Center menu item appears in their
          sub-account.
        </p>
        <Link className="button" href="/admin">
          Open the admin
        </Link>
      </section>
    </main>
  );
}

// The callback leaves the names in a short-lived cookie. No database lookup from
// anything the browser can type into a URL.
async function InstalledName() {
  const raw = (await cookies()).get("install_result")?.value;
  const names = parseInstalledNames(raw);
  if (names.length === 0) return null;
  if (names.length === 1) {
    return (
      <p>
        Sub-account: <strong>{names[0]}</strong>
      </p>
    );
  }
  return (
    <>
      <p>Sub-accounts:</p>
      <ul>
        {names.map((name) => (
          <li key={name}>
            <strong>{name}</strong>
          </li>
        ))}
      </ul>
    </>
  );
}

function parseInstalledNames(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { names?: unknown };
    return Array.isArray(parsed.names) ? parsed.names.filter((name): name is string => typeof name === "string" && name !== "") : [];
  } catch {
    return [];
  }
}
