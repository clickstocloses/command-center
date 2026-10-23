import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  NORTHSIDE,
  OWNER_EMAIL,
  TEAM_EMAIL,
  asAnonymous,
  asClient,
  asSecret,
  asStaff,
  seededClientId,
} from "./helpers";

describe("staff table", () => {
  let owner: SupabaseClient;
  let team: SupabaseClient;

  beforeAll(async () => {
    owner = await asStaff(OWNER_EMAIL);
    team = await asStaff(TEAM_EMAIL);
  });

  it("anonymous sees no staff", async () => {
    const { data } = await asAnonymous().from("staff").select("email");
    expect(data).toEqual([]);
  });

  it("team member sees the whole team", async () => {
    const { data } = await team.from("staff").select("email").order("email");
    expect(data?.map((row) => row.email)).toEqual([TEAM_EMAIL, OWNER_EMAIL]);
  });

  it("team member cannot change permissions", async () => {
    const { data } = await team
      .from("staff")
      .update({ permissions: { manage_staff: true } })
      .eq("email", TEAM_EMAIL)
      .select("id");
    expect(data).toEqual([]);
  });

  it("owner can change a team member's name", async () => {
    const { data, error } = await owner
      .from("staff")
      .update({ name: "Renamed Member" })
      .eq("email", TEAM_EMAIL)
      .select("name")
      .single();
    expect(error).toBeNull();
    expect(data?.name).toBe("Renamed Member");
    await asSecret().from("staff").update({ name: "Test Team Member" }).eq("email", TEAM_EMAIL);
  });

  it("a client session sees no staff", async () => {
    const northsideId = await seededClientId(NORTHSIDE);
    const { data } = await asClient(northsideId).from("staff").select("id");
    expect(data).toEqual([]);
  });
});

describe("usage_events and audit_log", () => {
  let northsideId: string;

  beforeAll(async () => {
    northsideId = await seededClientId(NORTHSIDE);
    const secret = asSecret();
    const usage = await secret.from("usage_events").insert({
      client_id: northsideId,
      purpose: "rls-test",
      model: "fake-model",
      input_tokens: 10,
      output_tokens: 5,
      cost_usd: 0.000123,
    });
    if (usage.error) throw new Error(usage.error.message);
    const audit = await secret.from("audit_log").insert({
      actor_type: "system",
      client_id: northsideId,
      action: "rls-test",
    });
    if (audit.error) throw new Error(audit.error.message);
  });

  afterAll(async () => {
    const secret = asSecret();
    await secret.from("usage_events").delete().eq("purpose", "rls-test");
    await secret.from("audit_log").delete().eq("action", "rls-test");
  });

  it("staff can read usage", async () => {
    const team = await asStaff(TEAM_EMAIL);
    const { data } = await team.from("usage_events").select("purpose").eq("purpose", "rls-test");
    expect(data).toEqual([{ purpose: "rls-test" }]);
  });

  it("staff cannot insert usage (only the server meters)", async () => {
    const owner = await asStaff(OWNER_EMAIL);
    const { error } = await owner.from("usage_events").insert({ purpose: "rls-test", model: "x" });
    expect(error?.code).toBe("42501");
  });

  it("a client cannot read its own usage", async () => {
    const { data } = await asClient(northsideId).from("usage_events").select("id");
    expect(data).toEqual([]);
  });

  it("staff can read the audit log", async () => {
    const team = await asStaff(TEAM_EMAIL);
    const { data } = await team.from("audit_log").select("action").eq("action", "rls-test");
    expect(data).toEqual([{ action: "rls-test" }]);
  });

  it("staff cannot write the audit log directly", async () => {
    const owner = await asStaff(OWNER_EMAIL);
    const { error } = await owner.from("audit_log").insert({ actor_type: "staff", action: "rls-test" });
    expect(error?.code).toBe("42501");
  });

  it("anonymous reads neither", async () => {
    const anonymous = asAnonymous();
    const usage = await anonymous.from("usage_events").select("id");
    const audit = await anonymous.from("audit_log").select("id");
    expect(usage.data).toEqual([]);
    expect(audit.data).toEqual([]);
  });
});
