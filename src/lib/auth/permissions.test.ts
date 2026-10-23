import { describe, expect, it } from "vitest";
import { PERMISSION_KEYS, TEAM_DEFAULT_PERMISSIONS, hasPermission } from "./permissions";

describe("hasPermission", () => {
  it("owner has every permission regardless of the checklist", () => {
    const owner = { role: "owner" as const, permissions: { delete: false } };
    for (const key of PERMISSION_KEYS) {
      expect(hasPermission(owner, key)).toBe(true);
    }
  });

  it("team member with an empty checklist gets the PRD defaults", () => {
    const team = { role: "team" as const, permissions: {} };
    expect(hasPermission(team, "view_clients")).toBe(true);
    expect(hasPermission(team, "run_generators")).toBe(true);
    expect(hasPermission(team, "manage_staff")).toBe(false);
    expect(hasPermission(team, "delete")).toBe(false);
  });

  it("an explicit false overrides a default true", () => {
    const team = { role: "team" as const, permissions: { run_generators: false } };
    expect(hasPermission(team, "run_generators")).toBe(false);
  });

  it("an explicit true overrides a default false", () => {
    const team = { role: "team" as const, permissions: { manage_staff: true } };
    expect(hasPermission(team, "manage_staff")).toBe(true);
  });

  it("a non-boolean value falls back to the default", () => {
    const team = { role: "team" as const, permissions: { delete: "yes", view_clients: 0 } };
    expect(hasPermission(team, "delete")).toBe(TEAM_DEFAULT_PERMISSIONS.delete);
    expect(hasPermission(team, "view_clients")).toBe(TEAM_DEFAULT_PERMISSIONS.view_clients);
  });
});
