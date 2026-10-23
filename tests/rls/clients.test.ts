import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BRIGHTLINE,
  NORTHSIDE,
  OWNER_EMAIL,
  TEAM_EMAIL,
  asAnonymous,
  asClient,
  asSecret,
  asStaff,
  seededClientId,
} from "./helpers";

describe("clients table", () => {
  let owner: SupabaseClient;
  let team: SupabaseClient;
  let northsideId: string;
  let brightlineId: string;

  beforeAll(async () => {
    owner = await asStaff(OWNER_EMAIL);
    team = await asStaff(TEAM_EMAIL);
    northsideId = await seededClientId(NORTHSIDE);
    brightlineId = await seededClientId(BRIGHTLINE);
  });

  afterAll(async () => {
    await asSecret().from("clients").delete().like("ghl_location_id", "loc_test_%");
  });

  it("anonymous sees nothing", async () => {
    const { data, error } = await asAnonymous().from("clients").select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("team member reads every client", async () => {
    const { data, error } = await team.from("clients").select("name").order("name");
    expect(error).toBeNull();
    expect(data?.map((row) => row.name)).toEqual(["Brightline Painting", "Northside Physio"]);
  });

  it("owner reads every client", async () => {
    const { data } = await owner.from("clients").select("id");
    expect(data).toHaveLength(2);
  });

  it("team member can update a client", async () => {
    const { data, error } = await team
      .from("clients")
      .update({ status: "onboarding_complete" })
      .eq("id", brightlineId)
      .select("status")
      .single();
    expect(error).toBeNull();
    expect(data?.status).toBe("onboarding_complete");

    await asSecret().from("clients").update({ status: "onboarding_in_progress" }).eq("id", brightlineId);
  });

  it("team member cannot create a client", async () => {
    const { error } = await team
      .from("clients")
      .insert({ ghl_location_id: "loc_test_team_insert", name: "Should Fail" });
    expect(error?.code).toBe("42501");
  });

  it("owner can create and delete a client", async () => {
    const { data: created, error: insertError } = await owner
      .from("clients")
      .insert({ ghl_location_id: "loc_test_owner_insert", name: "Owner Made Me" })
      .select("id")
      .single();
    expect(insertError).toBeNull();

    const { error: deleteError, count } = await owner
      .from("clients")
      .delete({ count: "exact" })
      .eq("id", created!.id);
    expect(deleteError).toBeNull();
    expect(count).toBe(1);
  });

  it("team member cannot delete a client", async () => {
    const { count } = await team.from("clients").delete({ count: "exact" }).eq("id", northsideId);
    expect(count).toBe(0);
  });

  it("client session reads only its own row", async () => {
    const { data, error } = await asClient(northsideId).from("clients").select("ghl_location_id");
    expect(error).toBeNull();
    expect(data).toEqual([{ ghl_location_id: NORTHSIDE }]);
  });

  it("client session cannot read another client by id", async () => {
    const { data } = await asClient(northsideId).from("clients").select("id").eq("id", brightlineId);
    expect(data).toEqual([]);
  });

  it("client session cannot change its own row", async () => {
    const { data } = await asClient(northsideId)
      .from("clients")
      .update({ monthly_budget_usd: 99999 })
      .eq("id", northsideId)
      .select("id");
    expect(data).toEqual([]);

    const { data: truth } = await asSecret().from("clients").select("monthly_budget_usd").eq("id", northsideId).single();
    expect(Number(truth?.monthly_budget_usd)).toBe(50);
  });

  it("a session with no client_id claim and no staff row sees nothing", async () => {
    const { data } = await asClient("00000000-0000-0000-0000-000000000000").from("clients").select("id");
    expect(data).toEqual([]);
  });
});
