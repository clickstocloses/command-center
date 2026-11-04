export const CLIENT_STATUS_LABELS: Record<string, string> = {
  onboarding_not_started: "Onboarding not started",
  onboarding_in_progress: "Onboarding in progress",
  onboarding_complete: "Onboarding complete",
  active: "Active",
  paused: "Paused",
  churned: "Closed",
};

export function clientStatusLabel(status: string): string {
  return CLIENT_STATUS_LABELS[status] ?? status;
}
