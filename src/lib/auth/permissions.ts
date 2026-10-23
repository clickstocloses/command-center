/**
 * Permissions are a checklist stored as JSON on each staff row, so adding one
 * is a change here plus a UI toggle, never a migration. The database only
 * knows owner versus team. Everything finer is decided in server code with this.
 */
export const PERMISSION_KEYS = [
  "view_clients",
  "run_generators",
  "edit_outputs",
  "share_outputs",
  "manage_usage_limits",
  "manage_staff",
  "manage_integrations",
  "delete",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];
export type StaffRole = "owner" | "team";

// PRD section 3: what a new team member can do before the owner changes anything.
export const TEAM_DEFAULT_PERMISSIONS: Record<PermissionKey, boolean> = {
  view_clients: true,
  run_generators: true,
  edit_outputs: true,
  share_outputs: true,
  manage_usage_limits: false,
  manage_staff: false,
  manage_integrations: false,
  delete: false,
};

type StaffLike = {
  role: StaffRole;
  permissions: Record<string, unknown>;
};

export function hasPermission(staff: StaffLike, key: PermissionKey): boolean {
  if (staff.role === "owner") return true;
  const value = staff.permissions[key];
  return typeof value === "boolean" ? value : TEAM_DEFAULT_PERMISSIONS[key];
}
