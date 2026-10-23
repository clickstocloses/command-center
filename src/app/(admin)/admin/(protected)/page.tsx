import { Suspense } from "react";
import { createUserSupabase } from "@/lib/supabase/server";

type ClientRow = {
  id: string;
  name: string;
  niche: string | null;
  status: string;
  ghl_location_id: string;
  updated_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  onboarding_not_started: "Onboarding not started",
  onboarding_in_progress: "Onboarding in progress",
  onboarding_complete: "Onboarding complete",
  active: "Active",
  paused: "Paused",
  churned: "Churned",
};

export default function AdminDashboardPage() {
  return (
    <>
      <section className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1>Clients</h1>
          <p className="muted">Every sub-account with Command Center installed.</p>
        </div>
        <a className="button" href="/api/oauth/install">
          Install on a sub-account
        </a>
      </section>
      <Suspense fallback={<p className="muted">Loading clients</p>}>
        <ClientTable />
      </Suspense>
    </>
  );
}

// Reads as the signed-in staff member. RLS is what decides what comes back.
async function ClientTable() {
  const supabase = await createUserSupabase();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, niche, status, ghl_location_id, updated_at")
    .order("name");

  if (error) return <p className="notice notice-error">Couldn&apos;t load clients: {error.message}</p>;

  const clients = (data ?? []) as ClientRow[];
  const counts = clients.reduce<Record<string, number>>((tally, client) => {
    tally[client.status] = (tally[client.status] ?? 0) + 1;
    return tally;
  }, {});

  return (
    <>
      <div className="row">
        <StatCard label="Total" value={clients.length} />
        {Object.entries(STATUS_LABELS).map(([status, label]) =>
          counts[status] ? <StatCard key={status} label={label} value={counts[status]} /> : null,
        )}
      </div>

      {clients.length === 0 ? (
        <section className="panel">
          <p className="muted">No clients yet. The first one appears when the app is installed on a sub-account.</p>
        </section>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Niche</th>
              <th>Status</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id}>
                <td>{client.name}</td>
                <td className="muted">{client.niche ?? "Not set"}</td>
                <td>{STATUS_LABELS[client.status] ?? client.status}</td>
                <td className="mono muted">{client.ghl_location_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="panel" style={{ minWidth: "9rem", gap: "var(--space-1)" }}>
      <span className="mono muted">{label}</span>
      <strong style={{ fontSize: "1.75rem", fontWeight: "var(--weight-display)" }}>{value}</strong>
    </div>
  );
}
