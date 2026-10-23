import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NORTHSIDE, OWNER_EMAIL, asAnonymous, asClient, asSecret, asStaff, seededClientId } from "./helpers";

describe("ghl_installations table (tokens)", () => {
  let northsideId: string;

  beforeAll(async () => {
    northsideId = await seededClientId(NORTHSIDE);
    const { error } = await asSecret().from("ghl_installations").insert({
      client_id: northsideId,
      ghl_location_id: NORTHSIDE,
      access_token_encrypted: "enc:fake-access",
      refresh_token_encrypted: "enc:fake-refresh",
      token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
      scopes: ["contacts.readonly"],
    });
    if (error) throw new Error(error.message);
  });

  afterAll(async () => {
    await asSecret().from("ghl_installations").delete().eq("ghl_location_id", NORTHSIDE);
  });

  it("the secret key can read tokens", async () => {
    const { data } = await asSecret().from("ghl_installations").select("ghl_location_id");
    expect(data).toEqual([{ ghl_location_id: NORTHSIDE }]);
  });

  it("the owner cannot read tokens", async () => {
    const owner = await asStaff(OWNER_EMAIL);
    const { data, error } = await owner.from("ghl_installations").select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("the client cannot read its own tokens", async () => {
    const { data } = await asClient(northsideId).from("ghl_installations").select("id");
    expect(data).toEqual([]);
  });

  it("anonymous cannot read tokens", async () => {
    const { data } = await asAnonymous().from("ghl_installations").select("id");
    expect(data).toEqual([]);
  });

  it("the owner cannot write tokens", async () => {
    const owner = await asStaff(OWNER_EMAIL);
    const { error } = await owner.from("ghl_installations").insert({
      client_id: northsideId,
      ghl_location_id: "loc_test_owner_token",
      access_token_encrypted: "x",
      refresh_token_encrypted: "y",
      token_expires_at: new Date().toISOString(),
    });
    expect(error?.code).toBe("42501");
  });
});
