import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { StatusChip } from "@/components/brand/StatusChip";
import { Wordmark } from "@/components/brand/Wordmark";
import { requireStaff } from "@/lib/auth/staff";
import { signOutAction } from "../login/actions";

// Everything under /admin except login and auth routes. The shell reads the
// session, so it sits inside Suspense (cache components is on).
export default function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<main className="page" />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

async function AdminShell({ children }: { children: ReactNode }) {
  const staff = await requireStaff();

  return (
    <main className="page">
      <header className="row" style={{ justifyContent: "space-between" }}>
        <Link href="/admin" style={{ color: "inherit" }}>
          <Wordmark />
        </Link>
        <div className="row">
          <StatusChip label={staff.role === "owner" ? "Owner" : "Team"} />
          <span className="muted">{staff.name}</span>
          <form action={signOutAction}>
            <button className="button button-ghost" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>
      {children}
    </main>
  );
}
