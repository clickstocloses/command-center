import { Suspense } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";

type SearchParams = Promise<{ reason?: string }>;

const REASONS: Record<string, string> = {
  denied: "The install was cancelled before it finished.",
  no_code: "HighLevel didn't send an authorization code. Start the install again from the link.",
  state: "This install didn't start from our link, or the browser lost track of it. Start again from the install link.",
  no_locations:
    "HighLevel approved the install but reports no sub-accounts with the app installed. Start again and tick at least one sub-account.",
  installed_lookup:
    "HighLevel wouldn't list the sub-accounts that have the app. The app may be missing the oauth.readonly scope in the developer portal.",
  location_token:
    "HighLevel wouldn't issue a sub-account token from the agency install. The app may be missing the oauth.write scope in the developer portal.",
  exchange: "HighLevel refused the token exchange. The app's client secret or redirect URL may be wrong.",
  save: "The install succeeded at HighLevel but couldn't be saved on our side. Tell Tom; the server log has the cause.",
};

export default function InstallErrorPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="page" style={{ maxWidth: "32rem" }}>
      <Wordmark />
      <section className="panel">
        <h2>The install didn&apos;t finish</h2>
        <Suspense fallback={null}>
          <Reason searchParams={searchParams} />
        </Suspense>
        <div className="row">
          <Link className="button" href="/api/oauth/install">
            Try again
          </Link>
          <Link className="button button-ghost" href="/admin">
            Admin
          </Link>
        </div>
      </section>
    </main>
  );
}

async function Reason({ searchParams }: { searchParams: SearchParams }) {
  const { reason } = await searchParams;
  return <p className="notice notice-error">{REASONS[reason ?? ""] ?? "Something unexpected happened."}</p>;
}
